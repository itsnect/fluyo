# FLUYO-019.1 — Piel B 2.5D en Present y exportación (validación visual)

Estado: **DONE — commiteado el 15 de octubre de 2026 (`6b80905`), capturas aprobadas por el owner.** Sin push ni deploy (pendientes del owner). READY para el siguiente paso (019.2). Handoff al final.
Owner/agente actual: libre.

> Esta tarea es la **fuente de verdad** de su trabajo. Repo público: solo contenido técnico del proyecto open source.
> Base: `FLUYO-019.md` (diagnóstico, sistema visual §4, riesgos §7, prototipo y capturas). Aquí no se repiten las medidas: se enlazan.
> Corre en paralelo con trabajo en `fluyo-mcp`. **No toca fluyo-mcp, ni el kernel, ni Share, ni el Viewer, ni el documento.**

## La pregunta que responde

> **¿La piel B 2.5D hace que Fluyo se vea y comunique mejor que el render plano?**

Nada más. Esta tarea es una **validación visual en el producto real**, con los documentos reales del usuario, en Present y en la exportación. Todo lo que no sirva para contestar esa pregunta queda fuera y se decide en 019.2 si la respuesta es sí.

## Alcance (cerrado por el owner)

| Sí | No |
|---|---|
| El **editor** sigue plano, sin cambio alguno de aspecto ni de gestos. | **Viewer** (`s/`, `viewer.js`, `share.css`): fuera por completo; no carga la piel. |
| **Present** pinta con la piel B (019 §4) y puede alternar a plano para comparar. | **Documento**: ningún campo nuevo; no se añade `settings.skin`; `model.js`, `serializeProject`, `settingsFromProjectData` y la versión de formato no cambian. |
| **Exportación SVG** pinta con la piel B (opción en el diálogo de exportar). | **Share** (`share-url.js`, `editor-share.js`, `deeplink.js`, `link-codec.js`): sin cambios; un share no sabe nada de la piel. |
| `js/skin.js` como capa **puramente visual**: funciones puras que devuelven segmentos. | **Kernel** (`config, safe-svg, model, scenario-engine, scenario-playback, story-playback, document-integrity`): sin cambios; `skin.js` no entra en la lista de `sync:kernel`. |
| La selección de la piel es **efímera**: estado de runtime del editor para Present y una opción del diálogo de exportar. No se persiste ni en el documento ni en `localStorage`. | **MCP**: fuera por completo; la paridad `svg.ts` se decide en 019.2. |
| Piezas: `rect` (y `default`), `cylinder`, `icon` (peana), conexiones (aterrizaje en cara visible + puerto de origen). | Bus, contenedor, exploded, isométrica (C), índices `01…`, LED ligado al estado, selección/acierto con caras (el editor es plano), WebGL/Three.js, telemetría nueva, `docs/`. |

**Sobre PNG/JPG/GIF**: la petición del owner nombra la exportación SVG. Los tres formatos raster salen del mismo `render(..., {export:true})` que recibiría la opción; por coherencia la opción «Aspecto» del diálogo se aplica a los cuatro formatos (una misma bandera). Si el owner prefiere limitarla al SVG, es una línea en `exGo` (ver paso 5); no cambia nada más.

## Dónde entra la piel (sin tocar el modelo)

```text
documento (sin cambios) → geometry.js (anclas, rutas, etiquetas: sin cambios)
                              → skin.js: skinNode / skinEdgeLanding / skinEdgePort → segmentos M/L/Q/A/Z
                                   → render.js (traceSegments)   ← Present (presentSkin) · export raster (opts.skin)
                                   → export.js (segmentsToSVGPath) ← export SVG (opts.skin)
   editor: render() sin bandera → plano (como hoy)     Viewer: no carga skin.js → plano (sin cambios)
```

La bandera es un **argumento de pintado**, no un dato: `render(c, t, {…, skin:"built"})`. Si falta, todo se pinta exactamente como hoy. El Viewer nunca la pasa y ni siquiera carga el módulo.

## Contrato de `js/skin.js`

Clásico (`<script src>`), puro, determinista, sin DOM, sin leer `doc`/`settings`/`presenting` globales (se pasan). Ninguna función escribe en el nodo ni en la conexión.

```text
SKIN_DEPTH = 8                     // unidades de mundo; vector d = (+8, −8): oblicua 45°, arriba-derecha
SKIN_MIN_PX = 3                    // corte a plano: canto en pantalla < 3 px (zoom < 0,375)
skinActive(skin, zoom)             // → skin==="built" && SKIN_DEPTH*zoom >= SKIN_MIN_PX   (export: zoom = scale)
skinNode(n, theme)                 // → { layers:[{segs, fill, stroke, sw, dash?, clip?}, …], label:{font, size, weight} } | null
                                   //   null = sin piel (hex, diamond, circle, text, code, image, anim): el pintor hace lo de hoy
                                   //   rect/default: línea de contacto, tapa, lateral, frente (radio 2), LED
                                   //   cylinder: contorno (tono frente), banda lateral (clip al contorno), tapa (tono claro), LED
                                   //   icon: peana (tapa, lateral, frente); glifo y pie los pinta el pintor de hoy
skinEdgeLanding(pts, toSide)       // → pts' (copia): último vértice desplazado d/2 si toSide ∈ {n, e}; el penúltimo acompaña
                                   //   se aplica DESPUÉS de edgePoints y ANTES de edgeStroke; laneLayout/orthoRoute/placeEdgeLabels no cambian
skinEdgePort(p, theme)             // → capa del anillo de origen (r 3, relleno = fondo del tema, borde = color de línea)
skinExtent(n)                      // → {x, y, w, h}: caja ∪ caja + d (recorte de overlays de Historia y apilado de cues)
skinTones(color, theme)            // → {top, front, side}: mezcla con el fondo 10/22/40 % (oscuro 14/26/46 %); sin gradientes
```

Medidas fijadas en 019 §4: radio del frente 2; línea tinta·0,45 (oscuro ·0,55) de 1 px; línea de contacto 2 px tinta·0,22 bajo la base; LED r 2,4 del color del nodo en (x0+10, y1−10); cilindro = `cylinderSegments` **sin cambios** + banda del 50 % del radio al borde; peana del icono `s+16 × 7` con `s = min(w, h−26)·0,78` (la de `drawNode`/`anchorBox`), apoyada en `y = top + 4 + s − 2`. El documento manda en `font`, `fs`, `bold`, `textColor`, `textBg`: la piel solo cambia el **defecto** tipográfico del rótulo a `IBM Plex Mono` 500 12 px cuando el nodo no trae `font` y `settings.font` es `DEFAULT_FONT`; si el usuario eligió tipografía global, se respeta.

Orden de pintado con la piel activa: contenedores no existen; los nodos se pintan en orden derivado (y ascendente, x descendente) **solo en Present/export con la piel**; el orden Z del documento no cambia y el editor sigue como hoy.

Historias en Present con la piel: `drawScenarioNodeOverlay` (`fillColor`, `dim`, `DOWN`, `highlight`) recorta a `skinExtent(n)` ∪ `shapePath`; `drawScenarioNodeCue` apila desde `skinExtent(n).y`. Tokens y llegadas (`drawFlowOverlay`) y puntos de flujo recorren `pts'`. El Trace no cambia.

## Selección efímera de la piel

- `let presentSkin="built";` en `js/state.js` junto a `presenting` (estado de runtime del editor; **no** entra en `serializeProject`, ni en autosave, ni en `localStorage`; se pierde al recargar, a propósito: es una validación).
- `buildEditorRenderState()` (`editor-runtime.js`) añade `viewport.skin = presenting ? presentSkin : "flat"`; `render()` lee `opts.skin ?? rs.viewport.skin ?? "flat"`.
- **Present**: botón `#prSkin` en `#presentBar`, junto a las páginas: «Construido» / «Plano» (texto, sin icono nuevo); tecla **B** alterna (no colisiona: Present usa ←/→, Espacio, Esc). Al salir de Present el valor se conserva durante la sesión para poder entrar y salir comparando.
- **Exportar**: fila «Aspecto» (`#exSkin`, select Plano · Construido) en el diálogo, inicializada con `presentSkin`; `exGo` pasa `skin` a `exportSVG` y a `exportStatic`/`exportGIF` → `render(..., {export:true, skin})` y `buildSVGDocument(scale, skin)`.
- Nada de esto escribe en `doc` ni en `settings`; `pushUndo` no interviene (no es documento).

## Criterios de aceptación

- [ ] Sin la bandera (editor, Viewer, export con «Plano»), **todo se pinta byte a byte igual que hoy**: los 8 ejemplos de `ejemplos/data` dan el mismo SVG y el mismo PNG que en `HEAD`; `serializeProject()` de cualquier documento es idéntico antes y después (ningún campo nuevo).
- [ ] En Present con «Construido»: `rect`, `cylinder`, `icon` y conexiones se pintan según el contrato en los tres temas; `hex`, `diamond`, `circle`, `text`, `code`, `image`, `anim` quedan planos y en su sitio.
- [ ] Tecla B y botón alternan sin reencajar la vista (`fitViewPresent` no se llama: `getBounds` no cambia con la piel).
- [ ] Export SVG con «Construido»: el SVG y el raster comparten segmentos (test de paridad: el golden recorrido con `segmentsToSVGPath` y con `traceSegments` sobre un contexto falso da los mismos vértices).
- [ ] Anclas, rutas (`edgePoints`), etiquetas (`placeEdgeLabels`), `getBounds`, `fitView`/`fitViewPresent`: mismos números con y sin piel.
- [ ] Corte a plano en Present por debajo de 3 px de canto (zoom 0,25 → plano; zoom 1 → piel), verificado en Chrome real.
- [ ] Historia en Present con la piel: `DOWN`, resaltado, símbolo y mensaje sobre la envolvente; «Trace antes = Trace después».
- [ ] `skin.js` determinista: dos llamadas con el mismo nodo dan los mismos segmentos; golden en los tres temas.
- [ ] Viewer: `s/index.html` y `viewer.js` sin diff; el smoke del Viewer existente sigue en verde.
- [ ] `CACHE` v85 con `./js/skin.js` en la lista; las 40 aserciones de `CACHE` de `test/` de fluyo actualizadas; smoke de upgrade v84→v85. (En fluyo-mcp no hay aserciones de `CACHE`: nada que tocar allí.)
- [ ] Sin `import` de nivel superior; `skin.js` cargado en `index.html` después de `geometry.js` y antes de `render.js`. **No** se añade a `s/index.html`.

## Plan

1. [ ] `js/skin.js`: contrato de arriba, cabecera con las medidas y la referencia a 019 §4. Golden `test/fixtures/fluyo-019-1-skin.json` generado desde el módulo en `vm` (por pieza y tema) y revisado a mano contra las capturas de 019.
2. [ ] `render.js`: `drawNode` → si `skinActive(opts.skin, zoom)` y `skinNode(n)` ≠ null, pinta `layers` con `traceSegments` (clip → `c.clip()`), luego el rótulo (y en `icon` el glifo y el pie como hoy); `drawEdge` → `pts' = skinEdgeLanding(pts, toSide)` antes de `edgeStroke`, puerto de origen; `render()` ordena los nodos de forma derivada cuando la piel está activa; overlays y cues sobre `skinExtent`; corte por zoom.
3. [ ] `export.js`: `renderNodeToSVG`/`renderConnectorToSVG` reciben `skin`; mismas capas vía `segmentsToSVGPath`; `clip` → `<clipPath id="skin-clip-{id}">` (como `code-clip-`); mismo orden derivado que el lienzo; `buildSVGDocument(scale, skin)`.
4. [ ] `state.js` + `editor-runtime.js`: `presentSkin` y `viewport.skin`. `ui.js`: `#prSkin` en `updatePresentBar`, tecla B en el manejador de teclado de Present (`interaction.js`, rama `presenting`).
5. [ ] `index.html`: botón `#prSkin` en `#presentBar`; fila `#exSkin` en el diálogo de exportar; `<script src="js/skin.js">` entre `geometry.js` y `render.js`. `export.js`: `exGo` lee `#exSkin` y lo pasa a los cuatro formatos (o solo a SVG si el owner lo acota).
6. [ ] `sw.js`: v85 + `./js/skin.js`; actualizar las 40 aserciones de `CACHE` en `test/`.
7. [ ] Tests: `test/fluyo-019-1.test.cjs` (vm: golden, determinismo, corpus byte a byte sin bandera, paridad canvas/SVG, Trace sin cambios, `serializeProject` idéntico) y `test/fluyo-019-1-browser.cjs` (Chrome real, Playwright externo vía `NODE_PATH`: editor plano vs Present construido en crema/oscuro/claro, tecla B, zoom 0,25 y 1, export SVG/PNG con cada aspecto, Viewer sin cambios desde un share, upgrade v84→v85).
8. [ ] Capturas comparables para la decisión del owner: los 8 ejemplos en Present, plano vs construido, crema y oscuro (en el scratchpad de la sesión, no en el repo). Handoff aquí con la respuesta propuesta a la pregunta de arriba.
9. [ ] `ARCHITECTURE.md`: sección breve «Piel 2.5D (FLUYO-019.1): capa visual efímera» con el diagrama de arriba. `DECISIONS.md`: solo si el owner cierra el GO de 019.2; esta fase no fija decisiones duraderas.

## Decisiones tomadas

- Las del owner (tabla de alcance). La piel es un argumento de pintado, nunca un dato.
- Valor interno `"built"` («Construido»); `"flat"` = plano. Son constantes de runtime, no claves de documento.
- `skin.js` fuera del kernel y fuera del Viewer.

## Lo que queda para 019.2 (si la respuesta es sí)

`settings.skin` persistente en el documento (con normalización de lista cerrada), Share y Viewer, paridad completa con golden compartido, y después el port en `svg.ts` del MCP. También: bus, contenedor, exploded y la vista isométrica como «vistas» de Present.

## Archivos a modificar (previsto)

- `js/skin.js` (nuevo) — la piel como datos.
- `js/render.js`, `js/export.js` — pintores con bandera.
- `js/state.js`, `js/editor-runtime.js`, `js/ui.js`, `js/interaction.js` — estado efímero, botón, tecla.
- `index.html` — botón de Present, fila de exportar, carga del módulo.
- `sw.js` — `CACHE` v85 + archivo nuevo.
- `test/fluyo-019-1.test.cjs`, `test/fluyo-019-1-browser.cjs`, `test/fixtures/fluyo-019-1-skin.json` (nuevos); aserciones de `CACHE` existentes.
- `.ai/ARCHITECTURE.md` — al cerrar.
- **No**: `js/model.js`, `js/viewer.js`, `s/index.html`, `css/share.css`, `js/share-url.js`, `js/editor-share.js`, `js/deeplink.js`, `js/link-codec.js`, ningún archivo del kernel, nada de `fluyo-mcp`.

## Pruebas

Previstas en el paso 7. Verificación manual en Chrome real: los 8 ejemplos en Present alternando con B, los tres temas; exportar SVG y PNG con cada aspecto y abrirlos.

## Pendientes / riesgos

- **Iconos reales**: el prototipo de 019 usó un marcador; validar la peana con los 72 iconos (`ICONS`) y con `tint`. Si algún glifo «flota», ajustar la `y` de la peana (constante única).
- **Rótulo de `icon`**: el pie de 26 px queda bajo la peana; `labelLayout` no cambia (la piel no toca `labelCenterY`).
- **`placeEdgeLabels`** mide la ruta sin el aterrizaje (4 px): aceptado en 019 §7; vigilar en pares paralelos con `arrowSize` 2×.
- **Tipografía por defecto**: pasar el rótulo a Plex Mono solo en Present puede sorprender al salir del editor; alternativa: respetar siempre `settings.font`. Decidir al ver el resultado real (no bloquea).
- **Rendimiento**: 019 §7 midió B al nivel de la pintura actual; la banda del cilindro es la única capa con `clip`: si pesa, precalcular la banda como polígono.
- **Expectativa**: al recargar, Present vuelve a «Construido» por defecto y la exportación hereda ese valor; es deliberado en esta fase (nada persiste).

## Handoff (15 de octubre de 2026)

### Qué se hizo
Los pasos 1–9 del plan, con el alcance de la tabla: el editor sigue plano; Present y la exportación pintan la piel B; la selección es efímera (`presentSkin`, botón `#prSkin`, tecla B, fila «Aspecto» del diálogo de exportar); nada entra en el documento; Viewer, Share, kernel, `model.js` y MCP intactos (verificado contra HEAD en `test/fluyo-019-1.test.cjs`).

### Archivos
- Nuevos: `js/skin.js`, `test/fluyo-019-1.test.cjs`, `test/fluyo-019-1-browser.cjs`, `test/fixtures/fluyo-019-1-skin.json`.
- Modificados: `js/render.js` (drawSkinLayers, nodeOverlayClip, rama de piel en drawNode, aterrizaje y puerto en drawEdge, bandera y orden en render), `js/export.js` (skinLayersToSVG, piel en renderNodeToSVG/renderConnectorToSVG, `buildSVGDocument(scale, skin)`, `exportSVG/exportStatic/exportGIF` con `skin`, fila del diálogo), `js/state.js` (`presentSkin`), `js/editor-runtime.js` (`viewport.skin`), `js/ui.js` (`togglePresentSkin`, `syncPresentSkinButton`), `js/interaction.js` (tecla B en Present), `index.html` (botón, fila, `<script src="js/skin.js">`), `sw.js` (v85 + `skin.js`), `.ai/ARCHITECTURE.md` (sección nueva).
- Tests ajustados: las 40 aserciones de `CACHE` (v84 → v85; `fluyo-018-27-mutations.cjs` baja su línea base a v84) y la regex de `test/fluyo-018-14a.test.cjs` que fijaba la línea literal de `exGo` (ahora admite el argumento `skin`; la espera a las fuentes es la misma).

### Decisiones tomadas en la implementación
- La fila «Aspecto» del diálogo se aplica a los **cuatro formatos** (SVG, PNG, JPG, GIF): todos pasan por el mismo `render(..., {export:true, skin})` / `buildSVGDocument(scale, skin)`. Limitarla al SVG es una línea en `exGo` si el owner lo prefiere.
- `presentSkin` arranca en `"built"` en cada carga (nada persiste, ni en `localStorage`).
- El pulso (`pulse`) de un `icon` sigue rodeando el glifo con la piel, como sin ella.
- Un color no hex (histórico) usa el mismo respaldo que el lienzo (`colHex`), para no añadir usos de `PALETTE[0]` (test de 018.15).

### Pruebas ejecutadas
- `node --test test/fluyo-019-1.test.cjs`: 18/18.
- `node test/fluyo-019-1-browser.cjs` (Chrome 155 real, Playwright externo vía `NODE_PATH`): **59/59**. Incluye: los 8 ejemplos y la escena dan el mismo SVG, el mismo raster de exportación y el mismo documento que HEAD en plano; Present construido medido en píxeles (tapa, lateral, tapa y banda del cilindro, peana del icono); `edgePoints`/`getBounds`/nodos iguales con y sin piel; B y botón; zoom 0,25 → plano; SVG `"built"` con capas y clip, `sin bandera === "flat"`; el diálogo arranca con el aspecto de Present y `exGo` entrega con o sin piel; Historia en Present: mismo Trace y 0 errores.
- Suite completa `node --test test/*.test.cjs`: 1127 ✔ · 84 ✘. Frente a la misma suite sobre el árbol de HEAD (76 fallos previos, ajenos a esta tarea: `FluyoStoryClock is not defined` en tests antiguos, etc.), los únicos fallos nuevos son **7 tests históricos de «alcance … idénticos a HEAD»** de slices anteriores (018.13–018.21), que comparan `render.js`/`export.js` con HEAD y **vuelven a pasar en cuanto se commitea** (es su diseño), y el de «fixtures del MCP ingesta-v2 y rag-chatbot» de 018.25, que también falla sobre HEAD con `fluyo-mcp` al lado (compara la geometría de HEAD consigo misma: previo, sin relación con esta tarea).
- Capturas reales (fuera del repo, scratchpad de la sesión `shots-019-1/`): `01-editor-plano`, `02-present-construido`, `03-present-plano`, `04-kafka-event-pipeline-{construido,plano}`, `04-microservicios-api-gateway-{construido,plano}`, `05-historia-present-construido`, `06-export-svg-construido`, `07-comparacion-plano-vs-construido`.

### Pendiente / riesgos
- **Revisión visual del owner** sobre las capturas: es la respuesta a la pregunta de esta tarea. Lo observado: los bloques y el cilindro ganan cuerpo sin mover nada; en los ejemplos reales (icon-heavy) el cambio lo llevan las peanas y los cilindros, que es exactamente lo previsto en 019.
- Las etiquetas de conexión siguen en la voz del documento (Georgia por defecto) mientras los rótulos de nodo pasan a Plex Mono con la piel: coherente con 019 §4, pero es una decisión de gusto que el owner puede revertir (`skinLabelFont` → `null`).
- Commit: `git` avisará de LF→CRLF en los archivos escritos con LF (`index.html`, `interaction.js`, `state.js`, `sw.js`, `skin.js`, tests, `.ai/*`); `core.autocrlf=true` lo normaliza al commitear, como en slices anteriores.
- 019.2 (si el owner confirma): `settings.skin` persistente, Share, Viewer, paridad con `svg.ts` (golden ya existe: `test/fixtures/fluyo-019-1-skin.json`), y después bus/contenedor/exploded.

### Próximo paso concreto
El owner revisa las capturas y, si da el visto bueno, commitea (sin push ni deploy hasta que lo diga). Si quiere la fila «Aspecto» solo para SVG, cambiar en `exGo` las llamadas a `exportGIF`/`exportStatic` para pasar `"flat"`.
