# FLUYO-018.19 — Teléfono en apaisado, diálogo de evento táctil y crear → colocar

Estado: **IMPLEMENTADO — READY FOR COMMIT** (ver el final). Sin commit, push ni deploy. `CACHE` v77 → v78.
Fecha: 13 de octubre de 2026 (auditoría, propuesta e implementación).
Owner/agente actual: libre.

> Repo público: nada de este documento es confidencial.
> Base: `fluyo` `f5087c9` (= `origin/main`; 018.18 integrado y publicado), árbol limpio, `CACHE` `fluyo-static-v77`.
> Fuentes leídas: `AGENTS.md`, `.ai/ARCHITECTURE.md`, `.ai/DECISIONS.md` (146–161), `.ai/tasks/FLUYO-018.17.md`, `.ai/tasks/FLUYO-018.18.md` (C7, C8, D13, D14). En código: `js/editor-scenarios.js` (`scOpenEventDialog`, `scSaveEventType`, `scBeginPlacement`, `scCanvasPlacementPointer`, `scResolveDrop`, `scApplyTargets`, `scCancelPlacement`, `scUpdatePlacementBar`, `scNotice`), `js/interaction.js` (entrada de `pointerdown`), `js/ui.js` (`mqSheet`, `isSheetLayout`, `storyState`, `visibleCanvasRect`, `placeChrome`), `index.html` (`#scEventDialog`, cabecera, rail, `#bottomBar`), `css/styles.css` (bloques `max-width:700px`, `max-height:500px` del diálogo, rail), `css/share.css` (Viewer en apaisado).
> **Esta fase no modifica nada del repositorio salvo este documento.** Sin commit, push ni deploy.

---

## 0. Resumen

En apaisado, un teléfono cae por anchura (> 700 px) en el layout de **tableta**: cabecera de 51 px + barra inferior de 45 px (25 % del alto), columna de Propiedades de 216 px **siempre visible** aunque no haya selección, rail que **no cabe** (3 herramientas inalcanzables con el dedo) y que, al recibir el foco, **desplaza la app entera 197 px hacia arriba**, y una columna de Historias cuya línea de tiempo mide **79 px y no enseña ni un paso entero**. Lienzo: 48 % editando, 45 % en Historias. No es un diseño: es la tableta aplicada por accidente. Present y Viewer, en cambio, funcionan bien en apaisado (93 % y 71 % de lienzo).

El diálogo de evento pide **11 bloques y 43 controles** para una acción que solo exige un nombre (todo lo demás tiene valor por defecto); 41 de 43 controles miden menos de 44 px con el dedo; en apaisado son **3,1–3,3 pantallas** de scroll. Y al pulsar «Crear evento» el usuario queda en un estado ambiguo: el aviso dice «Arrástralo a un elemento» (también con el dedo) y no hay colocación en curso. Además, mientras se coloca un evento **el lienzo no se puede desplazar ni pellizcar con el dedo: cualquier toque o arrastre en el vacío cancela la colocación**.

Propuesta: (1) el teléfono en apaisado usa **la gramática del teléfono con hojas laterales** (no la de tableta): una barra superior de 48 px que absorbe páginas y modos, sin barra inferior, rail vertical desplazable, Propiedades e Historias como hojas laterales derechas solo cuando se piden, y reproducir con una **franja de transporte inferior de una fila** (la misma forma que Present y el Viewer en apaisado); (2) un diálogo de evento **esencial primero** (Nombre · Dónde · Frase · Símbolo; la apariencia plegada con su vista previa dentro) a 44/40 px; (3) **«Crear evento» entra directamente en colocación**, sin estado nuevo de documento; (4) **colocar con el dedo distingue toque de arrastre**: el toque coloca, el arrastre desplaza, el vacío no cancela; (5) **reencaje al girar** en el editor. Sin tocar `model.js`, formato, kernel ni MCP.

## 1. Estado de partida (verificado)

- `git log`: `f5087c9 feat(fluyo): improve story playback and mobile UX` = `origin/main`; `git status` limpio; `sw.js` → `fluyo-static-v77`.
- Lo que **ya funciona y no se toca**: hoja de Historias de cuatro estados en vertical (146–147), zona libre única y suelo de zoom 0,6 (148), transporte y rótulo del momento (154–157), Present táctil (158), Viewer con encaje tras la banda y al girar (159), páginas sin ✕ y selector en el teléfono (160), «Trazo › Dirección» (161), Undo/Redo, 0 errores de consola en todos los recorridos de esta auditoría.

## 2. Método

Chrome real (`channel: "chrome"`, headless) con `playwright-core` **fuera del repo** (scratchpad de la sesión), árbol servido tal cual por un servidor HTTP efímero de solo lectura, Service Worker y red externa bloqueados. Dedo emulado (`hasTouch`, `isMobile`, densidad 2) con `touchscreen.tap` y `Input.dispatchTouchEvent` (arrastres); ratón en 1440 × 900 como referencia. Fixture `test/fixtures/fluyo-017-1-qa-complejo.fluyo.json` (2 páginas, 3 Historias, 6 eventos).

Viewports: **390 × 844, 375 × 812, 844 × 390, 812 × 375, 768 × 1024** (y 1440 × 900 para el diálogo con ratón). Medidas: % de pantalla que es lienzo (`elementFromPoint` cada 8 px), zona libre (`visibleCanvasRect`), cajas, objetivos < 44 px (dedo), pantallas de scroll, desbordamiento del documento, filas enteras de la línea de tiempo, contadores de `doc.eventTypes` / Steps / `undoStack` / `redoStack` antes y después de cada paso, número de toques. Scripts `a19/audit.cjs` (recorridos), `a19/probe*.cjs` (desbordamiento, gesto de colocación) y `a19/proto.cjs` (**prototipo de la composición propuesta inyectado solo en el navegador de auditoría**, para medir en vez de estimar); capturas en `a19/out/shots/` (no versionadas). Ningún test del repo se ejecutó: no hay cambios de código.

## Archivos modificados (auditoría)

- `.ai/tasks/FLUYO-018.19.md` — creado (este documento). Ningún otro archivo del repositorio se creó ni modificó.

## Handoff (auditoría)

### Estado actual

Auditoría y propuesta completas sobre `f5087c9`. Sin cambios de producto, tests ni `CACHE`; sin commit, push ni deploy.

### Próximo paso concreto

Revisar § Decisiones necesarias (D1–D15). Con ellas cerradas, implementar en el orden de § Plan de implementación (C4 → C3 → C2 → C1 → C5 → C6), validando cada paso con su caso dirigido, y actualizar esta tarea con el handoff de implementación.

---

## Estado

**READY FOR REVIEW** — auditoría y propuesta completas. Sin cambios de código, tests, `CACHE`, commit, push ni deploy. Pendiente de las decisiones D1–D15 (§ Decisiones necesarias).

---

## Hallazgos

### Landscape

| Medida | 844 × 390 | 812 × 375 | Referencia vertical 390 × 844 | 768 × 1024 |
|---|---|---|---|---|
| Layout en que cae | **tableta** (`isSheetLayout()` = false) | tableta | teléfono (hojas) | tableta |
| Cabecera + barra inferior | 51 + 45 = **96 px (25 %)** | 96 px (26 %) | 52 + 52 (12 %) | 96 (9 %) |
| Lienzo editando, sin selección | **48 %** | **46 %** | 82 % | 57 % |
| Columna de Propiedades sin selección | **216 px visibles** con «Nada seleccionado» | ídem | no (⚙ contextual, M2) | 216 px |
| Propiedades con un nodo | 43 % · **4,5 pantallas** de scroll (216 px de ancho) | 40 % · 4,8 | 37 % · 1,18 | 54 % · 1,43 |
| Rail | 536 px de contenido en 294: **Iconos, Imagen y GIFs fuera de la pantalla**; el rail no desplaza (`overflow:visible`) | ídem (279) | horizontal desplazable | cabe |
| Desbordamiento vertical del documento | **197 px**: con el foco en una herramienta del rail la app entera sube 197 px (la cabecera desaparece) | **212 px** | 0 | 0 |
| Desbordamiento horizontal | 0 | 0 | 0 | 0 |
| Historias (compacta) | **45 %**; línea de tiempo **79 px, 0 pasos enteros** de 7 | 43 %; 79 px, 0 | 72 % | 52 %; 490 px, 4 |
| Reproduciendo | 45 % (la columna se queda) | 43 % | 72 % | 52 % |
| Rótulo «MODO HISTORIA» y biblioteca vertical (84 px) | presentes | presentes | no (018.17) | presentes |
| Barra de páginas | pestañas, funciona (0 → 1), «＋» y activa a la vista | ídem | selector, funciona | pestañas |
| Present | **93 %**, mando en **una fila**, Reproducir funciona | 91 %, una fila | 89 %, dos filas | 97 % |
| Viewer | **71 %**, banda fija de 64 px, reproduce | 70 % | 82 % | — |
| Reencuadre | encaja al cargar (0,66); al entrar en Historias no se corta (decisión 151) | ídem | — | — |
| **Girar** el teléfono con el editor abierto (390 × 844 → 844 × 390, en Historias) | **no reencaja**: zoom 0,6 heredado, diagrama cortado (solo asoma «Comercio»); al volver a vertical sigue cortado | — | — | — |

Otros:

- La barra táctil (Conectar · Seleccionar varios) y la papelera flotante caben y no tapan la selección en apaisado.
- Controles < 44 px con el dedo en el editor apaisado: los 8 botones del rail (40 px, aceptado por la decisión 150), `speedIn`/`dotsIn` (40), ▾ de la pestaña (40), «＋» (44 × 40) y −/+/Encajar (40 × 44). Ninguno < 40.
- En el Viewer apaisado (> 700 px) las **pestañas de página miden 30 px de alto con el dedo** (el selector de 44 solo existe ≤ 700 px).
- Campos: 16 px con dedo (sin zoom de Safari al enfocar). El teclado virtual no se puede emular; aproximación reduciendo el viewport 200 px con «Nombre» enfocado en 844 × 390: quedan **61 px de cuerpo** entre cabecera (75) y pie (54) del diálogo. En iOS/Android reales el pie fijo queda **debajo** del teclado (el viewport de layout no se reduce): «Crear evento» no se ve hasta cerrar el teclado.

**Conclusión**: el apaisado de teléfono es la tableta por accidente. Gasta el alto en dos barras, la anchura en una columna sin propósito, rompe el rail y la Historia no se puede leer. Lo que sí está bien diseñado para apaisado (Present y Viewer) comparte un patrón: **lienzo + una franja de una fila**.

### Diálogo de evento

| Medida | 390 × 844 | 375 × 812 | 844 × 390 | 812 × 375 | 768 × 1024 | 1440 × 900 (ratón) |
|---|---|---|---|---|---|---|
| Forma | pantalla completa | pantalla completa | pantalla completa (dos columnas: formulario + vista previa de 329 px) | ídem | modal 736 × 970 | modal 760 × 852 |
| Cabecera / pie | 75 / 54 | 75 / 54 | 75 / 54 | 75 / 54 | 87 / 66 | 87 / 66 |
| Cuerpo útil | 715 | 683 | **261** | **246** | 815 | 697 |
| Pantallas de scroll, conexión (por defecto) | 1,31 | 1,43 | **3,12** | **3,31** | 1,0 | 1,15 |
| Pantallas de scroll, elemento | 1,05 | 1,17 | 2,37 | 2,51 | 1,0 | 1,0 |
| «Nombre» empieza en | **y = 272** (la vista previa va primero: 129 px fijos) | 272 | 127 | 127 | 167 | 164 |
| Controles < 44 (dedo) / < 28 (ratón) | **41 de 43** | 41 / 43 | 41 / 43 | 41 / 43 | 41 / 43 | 6 < 28 |
| ✕ · Cancelar · Crear evento | **29 × 29 · 80 × 29 · 108 × 29** | ídem | ídem | ídem | ídem | ídem |
| Segmentados · chips de la frase · «+ Origen» · «Más detalles» · «Ver ejemplo» | 34 · 27 · 24 · 26 · 25 | ídem | 38 · 27 · 24 · 26 · 29 | ídem | ídem | ídem |
| ¿Tapa el contexto del lienzo? | sí (pantalla completa) | sí | sí | sí | velo modal | velo modal |

Estructura (lo que de verdad pide el formulario):

- **Obligatorio: solo el Nombre.** «¿Dónde ocurre?» (conexión por defecto), la frase (cambia sola según el «dónde»: `scSwitchPhraseForWhere`), el símbolo (●) y toda la apariencia tienen valor por defecto válido.
- Para una conexión, «¿Cómo viaja este evento?» va **abierto por defecto** con cuatro segmentados de tres opciones (tamaño, movimiento, rastro, llegada) + «Más detalles» (velocidad, «mientras viaja»): 328 px, el 35 % del formulario, para ajustes que casi nunca se cambian al crear. Para un elemento, «Personalizar apariencia» y «Comportamiento» ya van plegados: por eso el elemento ocupa ~1 pantalla y la conexión 1,3–3,3.
- La frase se edita como cajas: los segmentos vacíos se pintan como **cajas vacías de 35 × 44** junto a chips de 27 px; los botones de inserción miden 24 px.
- Cabecera con un subtítulo («Disponible en todo este proyecto.») que no ayuda a crear; glifos decorativos en los efectos (◎ T ✦ ◐ ✺ ●) y «×» tipográfico en el cierre.
- Durante una reproducción, «+ Crear evento» está deshabilitado (correcto).

### Creación → colocación

Recorrido medido con el dedo (Historias → Ampliar → «+ Crear evento» → «En un elemento» → Nombre → Crear evento → ficha → nodo):

| Paso | Estado medido |
|---|---|
| Crear evento | `doc.eventTypes` 6 → 7; **1 entrada de Undo**; diálogo cerrado; **sin colocación en curso** (`scPlacement` = null); aviso «Aviso ya está en Eventos. **Arrástralo** a un elemento.» (con el dedo arrastrar no es la vía: se toca); el foco va a la ficha nueva |
| Tocar la ficha | entra en colocación: barra «Aviso: elige un elemento en el sistema.» + Cancelar (88 × 44). En el teléfono la hoja se aparta (bien) |
| Tocar el nodo | Step 7 → 8; **2.ª entrada de Undo**; aviso «Añadido a la historia.»; la fila nueva queda a la vista en vertical y en tableta, **no en apaisado** (línea de tiempo de 79 px) |
| Deshacer ×1 / ×2 | quita el Step (7) / quita el evento (6); Rehacer ×2 lo devuelve todo (8 Steps, 7 eventos) |
| Cancelar o ✕ en el diálogo | sin rastro (ni evento ni Undo) |
| Crear y cancelar la colocación | el evento queda en la biblioteca **sin usar** (vocabulario del documento, decisión 103/108), la Historia no cambia, 1 Undo |
| Toques mínimos hoy | 7 en el teléfono (6 en columna); el problema no es el número sino el **estado ambiguo** tras «Crear»: el usuario tiene que descubrir que debe tocar la ficha |
| En apaisado colocando | zona libre **528 × 199 px**; la barra de colocación (70 px) tapa el pie del lienzo y **el aviso «Arrástralo…» se pinta encima del texto de la barra** (el ajuste de 018.17 solo existe ≤ 700 px) |

- **Nada queda «parcialmente creado»**: el evento es un EventType completo y válido en cuanto se pulsa «Crear»; el Step solo nace al tocar el destino (`scApplyTargets`, que además crea la Historia si no hay ninguna en la misma entrada de Undo).
- Cambiar de página durante la colocación la cancela (`scValidatePlacement`): correcto.
- No hay navegación «atrás» propia (sin History API): el botón atrás del sistema sale del editor (el documento está autoguardado).

### Touch

- **Colocando, el lienzo no admite gestos con el dedo.** `scCanvasPlacementPointer` resuelve en `pointerdown` y consume el evento: un **arrastre** en el vacío (80 px) no desplaza la vista (`viewX` igual) y **cancela** la colocación («No se añadió nada. Elige una conexión compatible.»); un **toque** en el vacío también cancela; el primer dedo de un pellizco, igual. Con el suelo de zoom 0,6 y una zona libre de 199 px en apaisado (o 338 en vertical), un destino fuera de la vista **no se puede alcanzar** sin cancelar, salir, desplazar y volver a empezar. Verificado en 390 × 844 y 844 × 390.
- Diálogo: 41/43 controles < 44 px (tabla anterior); los que cierran o confirman (✕, Cancelar, Crear) a 29 px.
- Rail apaisado: 3 herramientas inalcanzables con el dedo (no hay desplazamiento posible).

### Visual

- Apaisado: dos barras de chrome inerte (cabecera con conmutador «Editar · Historias», «Lienzo» y Exportar; barra inferior con −/66 %/+/Encajar), rótulo «MODO HISTORIA», columna de ayuda sin selección: densidad de herramienta de escritorio en 390 px de alto. Es la sensación «editor de diagramas genérico» que el North Star quiere evitar.
- Diálogo: formulario de tres niveles (pregunta, subpregunta, segmentado) para lo opcional; cajas vacías en la frase; subtítulo; glifos decorativos (◎ T ✦ ◐ ✺ ●, «×») fuera del sprite (decisión 126). La vista previa «Así se verá» (el punto que recorre la conexión) **sí** es identidad del producto: se conserva, pero donde sirve (al ajustar la apariencia).
- Sin marcas, logos ni branding añadido en ninguna superficie auditada (el único enlace al repositorio vive en «Más», como contenido, no como decoración).

### Compatibilidad

- Todo lo propuesto es **interfaz**: `scBeginPlacement`, `scApplyTargets`, `createEventType`, `pushUndo` y la colocación ya existen y hacen lo correcto; el cambio es **cuándo** se llaman y cómo se reparte el espacio.
- **No hace falta** tocar `model.js`, el formato `.fluyo.json`, el kernel (`config`, `safe-svg`, `model`, `scenario-engine`, `scenario-playback`, `story-playback`, `document-integrity`, `story-authoring`), `story-clock.js`, el MCP, Share ni el render. Undo/Redo: mismas dos entradas que hoy (crear, colocar). Viewer: sin cambios salvo, si se aprueba D14, una regla CSS de objetivo táctil.

---

## Propuesta

### Criterio

1. **Un teléfono, una gramática.** En vertical y en apaisado rigen las mismas reglas del teléfono (⚙ contextual, hojas que se piden y se cierran, cuatro estados de Historias, 44/40 px, zona libre única); la orientación solo decide **de dónde salen las hojas**: de abajo en vertical, **del lado derecho** en apaisado.
2. **En apaisado sobra alto, no ancho**: nada horizontal de chrome que no sea imprescindible; una sola barra superior.
3. **Reproducir es una franja de una fila** en las tres superficies apaisadas (Present y Viewer ya lo son).
4. **Crear es empezar a colocar.** Tras «Crear evento» no hay un estado intermedio que descubrir.
5. **El dedo nunca pierde una intención por accidente**: colocar no se cancela por tocar el vacío ni por desplazar.
6. **Se quita chrome antes que encoger controles** (decisión 150): nada baja de 44/40.

### C1 — Apaisado de teléfono: lienzo + hoja lateral

**Cuándo**: `(orientation: landscape) and (max-height: 500px) and (pointer: coarse)` (D2). Con esa condición `isSheetLayout()` es verdadero (gramática del teléfono) y un segundo predicado `isSideSheet()` decide la posición lateral. Tableta (768 × 1024, 1024 × 768) y escritorio no cambian.

```text
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ fluyo  ↶ ↷  [01 Pago complejo ▾]                   (⚙)  [☰ Historias] [▶ Presentar] 🔗 ⋯ │  48 px
├──┬──────────────────────────────────────────────────────────────────────────────────┤
│▸ │                                                                                  │
│╱ │                               LIENZO (≈ 83 %)                                    │
│▭ │                                                                                  │
│⌸ │                                                                                  │
│◇ │                                                                                  │
│⋮ │  rail vertical desplazable (52 px)                                              │
└──┴──────────────────────────────────────────────────────────────────────────────────┘
   Propiedades (⚙):  ─────────── lienzo ───────────┬──── hoja lateral 320 ────┐
   Historias:        ─────────── lienzo ───────────┬──── hoja lateral 320 ────┐  (Historia ▾ · ⋯ / Reproducir · Volver a editar / fichas / línea de tiempo)
   Reproduciendo:    ─────────── lienzo (≈ 71 %) ──────────────────────────────┐
                     [⏮][❚❚ Pausar][⏭]  2 / 4          [■ Detener] [⌃ Línea de tiempo] [← Volver a editar]   franja de 64 px
```

| Pieza | Hoy (tableta por accidente) | Propuesta |
|---|---|---|
| Barra superior | 51 px; conmutador Editar·Historias, Lienzo, Exportar, Compartir, Presentar, Más | **48 px**: logo · ↶ ↷ · **selector de página** (el de 018.18, con elipsis; es lo primero que cede ancho) ··· ⚙ (solo con selección) · **Historias** · **Presentar** · Compartir (icono) · Más. Exportar y «Lienzo» viajan a «Más» como en vertical (`placeChrome`, mismos nodos y mismos ids) |
| Barra inferior | 45 px (páginas, −/%/+/Encajar) | **no existe**: páginas y modos suben a la barra superior (`#pagesBar` y `#modeBar` cambian de padre); el zoom es el pellizco, como en vertical |
| Rail | 56 px, 3 herramientas fuera e inalcanzables, desborda el documento | 52 px, **desplazable en vertical** (como el horizontal del vertical), con un velo en el borde que indica que hay más; el documento ya no desborda |
| Propiedades | columna de 216 px siempre, 4,5 pantallas | **hoja lateral derecha de 320 px solo con selección** (⚙ contextual, M2 de 018.17), acordeón y una fila de muestras como en vertical; se cierra con ✕, ⚙ o tocando el vacío |
| Historias | columna de 300 px; «MODO HISTORIA»; biblioteca vertical; línea de tiempo 79 px | **hoja lateral derecha de 320 px con la cabecera de dos filas del teléfono** (Historia ▾ · ⋯ / Reproducir · Volver a editar), fichas en carril y la línea de tiempo como único desplazable. Compacta y ampliada son la misma hoja (en apaisado la altura completa ya es el taller): «Ampliar» no se pinta salvo reproduciendo |
| Reproduciendo | la columna se queda (45 %) | la hoja se recoge en una **franja inferior de una fila** con el transporte de 018.18 y la salida; «Línea de tiempo» (el ⌃ Ampliar de siempre) abre la hoja lateral con la fila activa seguida. El rótulo del momento sigue sobre el lienzo |
| Present / Viewer | 93 % · 71 %, ya correctos | sin cambios (D14: pestañas del Viewer a 44 px con dedo) |
| Zona libre | lienzo − columna − barras | `visibleCanvasRect()` descuenta la hoja lateral (por la derecha) o la franja (por abajo): `revealAboveSheet`, `scRevealTarget`, `scPlaceNow` y la barra táctil la usan sin saber dónde está la hoja |
| Avisos y barra de colocación | el aviso tapa la barra | `#scNotice` y `#scPlacementBar` se centran en la zona libre y el aviso nunca se superpone a la barra (regla de 018.17 extendida) |

**Medido con el prototipo inyectado** (no es código del repo; solo CSS + mover dos nodos en el navegador de auditoría):

| | 844 × 390 hoy → propuesta | 812 × 375 hoy → propuesta |
|---|---|---|
| Editar, sin selección | 48 % → **83 %** | 46 % → **82 %** |
| Propiedades con un nodo | 43 % · 4,5 pantallas → **49 % · 1,1 pantallas** | 40 % · 4,8 → **48 % · 1,15** |
| Historias | 45 % → **54 %** | 43 % → **53 %** |
| Línea de tiempo | 79 px, 0 pasos enteros → 100 px con la estructura de columna; **≈ 160 px con la cabecera de dos filas del teléfono** (estimado: se quitan la fila «Volver a editar» de 53 px y la biblioteca vertical) | ídem |
| Reproduciendo | 45 % → **≈ 71 %** (844 × (390 − 48 − 64)) | 43 % → ≈ 70 % |
| Desbordamiento del documento | 197 px → **0** | 212 px → **0** |
| Barra superior | — | cabe en una fila con 10 px de margen sin ⚙; con ⚙ el selector de página cede ~40 px (elipsis) |

Coherencia: el teléfono en apaisado queda como **Present y el Viewer en apaisado** (lienzo protagonista + una franja) cuando se reproduce, y como **el teléfono en vertical girado** cuando se edita. Se descarta: barra inferior mínima (ocupa alto, que es lo escaso: lienzo ≈ 72 % en vez de 83 %), hoja inferior en apaisado (con 342 px de alto deja una franja), panel izquierdo (choca con el rail y con el pulgar izquierdo que sostiene el teléfono), y mantener la columna de tableta (es el problema).

### C2 — Diálogo de evento: lo esencial primero

```text
 vertical (390)                                   apaisado (844 × 390)
┌──────────────────────────────────┐   ┌──────────────────────────────────────────────────────────────┐
│ Crear evento                  [✕]│   │ Crear evento                                              [✕]│ 52
├──────────────────────────────────┤   ├──────────────────────────────────────────────────────────────┤
│ Nombre                           │   │ Nombre [Por ejemplo, Pago           ]  ¿Dónde? [Conexión|Elemento] │
│ [Por ejemplo, Pago             ] │   │ ¿Cómo lo cuentas?  Origen · envía a · Destino   [+ Origen][+ Destino]│
│ ¿Dónde ocurre? [Conexión|Elemento]│   │ Símbolo  ● 💵 📦 👤 📨 ✓ ⚠ +                                  │
│ ¿Cómo lo cuentas?                │   │ ▸ Cómo se ve   Mediano · Directo · Sin rastro                 │
│  Origen · envía a · Destino      │   ├──────────────────────────────────────────────────────────────┤
│  [+ Origen][+ Destino][+ Nombre] │   │                                   [Cancelar] [Crear evento]  │ 60
│ Símbolo ● 💵 📦 👤 📨 ✓ ⚠ +       │   └──────────────────────────────────────────────────────────────┘
│ ▸ Cómo se ve  Mediano · Directo… │
│   (dentro: vista previa «Así se  │
│    verá» + los ajustes de hoy)   │
├──────────────────────────────────┤
│           [Cancelar][Crear evento]│
└──────────────────────────────────┘
```

- **Primer nivel = lo que define el evento**: Nombre, ¿Dónde ocurre?, frase, símbolo. **Segundo nivel plegado = cómo se ve**: para una conexión, «Cómo se ve» reúne lo que hoy es «¿Cómo viaja este evento?» + «Más detalles»; para un elemento, «Personalizar apariencia» (como hoy) y «Comportamiento» (como hoy). Cada grupo plegado enseña su resumen en una línea (patrón que ya existe: `scAppearanceSummary`). La vista previa animada (`drawFlowOverlay`, el mismo pintor de Playback) **vive dentro de «Cómo se ve»**, donde sirve; arriba queda la frase resuelta («Cliente envía a Comercio») como resumen de texto.
- Al **editar** un evento con apariencia no por defecto, «Cómo se ve» se abre solo (como hoy `scSetAccordionOpen(..., hasAppearance)`).
- **Objetivos**: con dedo, 44 px para ✕, Cancelar, Crear/Guardar, cada opción de los segmentados, los resúmenes de los plegables y «Ver ejemplo»; 40 px para chips de la frase, botones de inserción, símbolos y efectos. Con ratón, nada < 28 (hoy 24–27 en inserción, chips y «Más detalles»).
- **Cabecera** de 52 px solo con el título (sin subtítulo) y ✕ del sprite; **pie** de 60 px con `safe-area`. «Nombre» con `enterkeyhint="done"`: Intro en el Nombre equivale a «Crear evento» (con el teclado virtual abierto el pie queda debajo; así no hace falta cerrarlo).
- **Frase**: mismos segmentos y mismo modelo; los segmentos de texto vacíos dejan de pintarse como cajas (borde solo al enfocar). Rediseñar el editor de la frase queda fuera (§ Fuera de alcance).
- **Efectos**: los chips pierden los glifos decorativos (◎ T ✦ ◐ ✺ ●) y quedan como texto con estado (D13).
- **Apaisado**: una columna (la vista previa deja de ser una columna fija de 329 px), Nombre y «¿Dónde?» en la misma fila.
- **Escritorio y tableta**: misma estructura (lo esencial primero, «Cómo se ve» plegado); sin pantalla completa; mismas ids.

Estimación sobre las alturas medidas: vertical 390, conexión **1,31 → ≈ 0,75 pantallas** (sin scroll); apaisado 844 × 390, **3,12 → ≈ 1,2**; «Nombre» en y ≈ 68 (hoy 272).

Ids conservados: `#scEventDialog`, `#scEventName`, `scWhere`, `#scPhrase`, `#scPhraseInsert`, `#scVisualPicker`, `#scFlowLook` (pasa a ser el cuerpo de «Cómo se ve» en conexiones), `#scFlowMore`, `#scAppearance`, `#scBehavior`, `#scPreviewDiagram`, `#scPreviewPlay`, `#scEventSave`, `#scEventCancel`, `#scEventClose`, `#scEventError`, todos los `name=` de los radios.

### C3 — Crear evento → colocar

```text
«+ Crear evento» ─▶ diálogo ─▶ [Crear evento] ─▶ EventType creado (1 Undo, como hoy)
                                     │
                                     └─▶ colocación en curso con ESE evento (sin tocar la ficha)
                                          barra: «Aviso creado · Toca el elemento donde ocurre · Se añadirá al final, 1 s después»  [Cancelar]
                                          ├─ toque en un destino válido ─▶ Step creado (2.º Undo, como hoy) ─▶ hoja/columna con la fila nueva a la vista
                                          ├─ Cancelar / Escape ─▶ el evento queda en la biblioteca sin usar (como hoy)
                                          ├─ cambiar de página ─▶ se cancela (como hoy, scValidatePlacement)
                                          └─ toque en el vacío / arrastre ─▶ sigue colocando (C4)
[Guardar cambios] (editar) ─▶ como hoy: no entra en colocación
```

- **Implementación**: al final de `scSaveEventType`, solo si se ha **creado** (no al editar): `scBeginPlacement(id)` en lugar del aviso «Arrástralo…». La barra de colocación dice «*Nombre* creado · Toca el elemento / la conexión donde ocurre» + la pista temporal que ya existe (`scTemporalHint`) y lleva el foco a «Cancelar» con anuncio `aria-live`. En la hoja móvil la hoja se aparta como ya hace al colocar (`body.scPlacing`); en la columna, la fila nueva se trae a la vista al colocar.
- **Si no se puede colocar** (Historia de un motor anterior, `scCanPlaceEvents()` falso): se queda como hoy, pero el aviso dice «Tócalo en Eventos y luego toca dónde ocurre» con el dedo (y «Arrástralo…» solo con ratón).
- **Estados nuevos**: ninguno en el documento ni en `localStorage`. Solo un campo efímero `scPlacement.origin = "created"` para el texto de la barra. Undo: **las mismas dos entradas de hoy** (crear el EventType; colocar el Step, que si hace falta crea la Historia en la misma entrada). Deshacer tras colocar quita el Step; otra vez, el evento.
- Ratón y escritorio: mismo flujo (con ratón se puede seguir arrastrando la ficha; el clic coloca).
- «Duplicar evento» abre el mismo diálogo y crea un evento nuevo: ver D9.

### C4 — Colocar con el dedo: tocar coloca, arrastrar desplaza

- Con `pointerType === "touch"`, `scCanvasPlacementPointer` deja de consumir el `pointerdown`: el lienzo hace su gesto normal (desplazar con un dedo, pellizcar con dos) y la colocación se resuelve en el `pointerup` **solo si fue un toque** (un dedo, < 8 px de movimiento, sin pellizco por medio). Un toque en el vacío **no cancela**: la barra repite «Toca un elemento» con un realce breve. Se sale con Cancelar, Escape o cambiando de página.
- Con ratón, sin cambios (clic resuelve; clic en el vacío cancela; arrastrar la ficha sigue funcionando), salvo que D11 decida lo contrario.
- `interaction.js`: un gancho en `pointerup` (`scCanvasPlacementTap(ev)`), simétrico al de `pointerdown` que ya existe. Es el único cambio en ese archivo.

### C5 — Reencaje al girar (editor)

La misma regla de la decisión 151, ampliada al giro y al cambio de layout: si al cambiar de orientación (o de layout por `matchMedia`) el diagrama **cabía** antes y queda **cortado** después, se reencaja (`fitView` en Editar; `revealAboveSheet` en Historias, con su suelo de 0,6). Una vista que el usuario había acercado no se toca. El Viewer ya lo hace desde 018.18.

### C6 — Viewer apaisado: pestañas táctiles (opcional, D14)

Una regla en `css/share.css`: con `pointer:coarse`, los botones de `#pgTabs` a `--ctl-h-touch` (hoy 30 px). Sin cambios de JS ni de comportamiento.

---

## Decisiones necesarias

| | Decisión | Recomendación | Alternativa | Impacto |
|---|---|---|---|---|
| **D1** | Alcance de 018.19 | C1–C5 (+ C6 si D14), en el orden del plan | Partir: 018.19a = C3–C4 (crear → colocar y gesto), 018.19b = C1, C2, C5 | Con todo junto se valida una sola vez el teléfono; partido, el primer tramo es muy pequeño y casi sin riesgo |
| **D2** | Qué es «teléfono en apaisado» | `(orientation: landscape) and (max-height: 500px) and (pointer: coarse)` → gramática del teléfono con hojas laterales | Sin `pointer:coarse` (también ventanas de escritorio bajas con ratón) | Con `coarse`, el escritorio no cambia nunca (D7 de 018.17); sin él, una ventana de 1280 × 480 recibiría hojas laterales |
| **D3** | Barra única superior de 48 px; sin barra inferior; páginas y modos arriba; Exportar y «Lienzo» a «Más» | Sí | Barra inferior mínima de 44 px con páginas y modos | Recomendada: 83 % de lienzo; alternativa ≈ 72 %. Cambia las expectativas de apaisado de `018-17-browser` y `018-18-browser` |
| **D4** | Propiedades en apaisado | Hoja lateral derecha de 320 px, solo con selección (⚙ contextual), cierre como en vertical | Abrir la hoja automáticamente al seleccionar | Recomendada: el lienzo manda (83 % sin abrirla, 49 % abierta); automática: cada toque en un nodo come el 38 % del ancho |
| **D5** | Historias en apaisado | Hoja lateral de 320 px con la cabecera de dos filas del teléfono; compacta = ampliada; «Ampliar» solo reproduciendo | Conservar la estructura de columna de escritorio en la hoja | Recomendada: línea de tiempo ≈ 160 px (hoy 79, 0 pasos); `storyState()` sigue devolviendo los mismos cuatro valores |
| **D6** | Reproducir en apaisado | La hoja se recoge en una franja inferior de una fila (transporte + Detener + Línea de tiempo + Volver a editar); ≈ 71 % de lienzo | La hoja lateral se queda (≈ 54 %) | Recomendada: misma forma que Present y Viewer apaisados; actualiza la decisión 146 solo en apaisado |
| **D7** | Diálogo: esencial primero, «Cómo se ve» plegado con la vista previa dentro, 44/40 px, sin subtítulo, una columna en apaisado, Intro en el Nombre = Crear | Sí | Solo objetivos táctiles (44/40) y Nombre primero | Recomendada: 1,31 → ≈ 0,75 pantallas (vertical) y 3,1 → ≈ 1,2 (apaisado). Alternativa: 3,1 → ≈ 2,8 |
| **D8** | Crear → colocar | «Crear evento» entra en colocación; el botón conserva su texto; la barra explica el paso | Rotular el botón «Crear y colocar» | Con el texto de siempre el escritorio no cambia de vocabulario; la barra dice lo que ocurre. La alternativa es más explícita pero falsea el caso sin colocación posible |
| **D9** | «Duplicar evento» | **No** entra en colocación (se duplica para cambiar dónde ocurre o su comportamiento, no para usarlo ya) | Sí, igual que crear | Mínimo: un `if` |
| **D10** | Undo de crear → colocar | Dos entradas (crear, colocar), como hoy; cancelar la colocación deja el evento en la biblioteca | Descartar el evento si se cancela la colocación | Recomendada: no se pierde el trabajo del diálogo y no se toca Undo. Alternativa: Undo compuesto o borrado implícito (más estados, más riesgo) |
| **D11** | Gesto de colocación | Con el dedo: toque coloca al soltar, arrastre desplaza, pellizco amplía, el vacío no cancela. Ratón: como hoy | Mismo criterio también con ratón (el clic en el vacío deja de cancelar) | Recomendada: el escritorio no cambia; alternativa: coherencia total, pero cambia un hábito de ratón y los tests de 011/012 |
| **D12** | Reencaje al girar en el editor | Sí, regla de la decisión 151 (solo si cabía y queda cortado) | Reencajar siempre al girar | Recomendada: respeta un zoom elegido; la alternativa lo pisa |
| **D13** | Glifos de los efectos (◎ T ✦ ◐ ✺ ●) | Quitarlos: chips de texto con estado | Sustituirlos por iconos nuevos del sprite | Recomendada: sin iconos nuevos; la alternativa abre trabajo de iconografía (018.20+) |
| **D14** | Pestañas del Viewer apaisado a 44 px con dedo (C6) | Sí, una regla de `share.css` | Dejarlo para 018.20 | Toca un archivo del Viewer (riesgo bajo, solo CSS con `pointer:coarse`) |
| **D15** | Viewports del browser test | Los cinco pedidos **+ 667 × 375** (iPhone SE/8 apaisado: cumple a la vez `max-width:700px` y apaisado corto; es donde chocan las reglas) | Solo los cinco | Una pasada más (≈ 1/6 del tiempo del test) a cambio de cubrir la intersección |

---

## Alcance

Entra en 018.19 (si se aprueba como se propone):

1. **C1** — layout de teléfono en apaisado: predicados `isSheetLayout()`/`isSideSheet()`, barra superior única, sin barra inferior, rail desplazable sin desbordar el documento, Propiedades e Historias como hojas laterales, franja de reproducción, zona libre con hoja lateral o franja, avisos y barra de colocación dentro de la zona libre.
2. **C2** — diálogo de evento: esencial primero, «Cómo se ve» plegado con la vista previa, 44/40 px (dedo) y ≥ 28 (ratón), cabecera sin subtítulo, ✕ del sprite, Intro = Crear, frase sin cajas vacías, efectos sin glifos (D13), una columna en apaisado.
3. **C3** — crear → colocar, con la barra que explica el paso y el aviso correcto según el puntero.
4. **C4** — gesto de colocación con el dedo (toque / arrastre / pellizco; el vacío no cancela).
5. **C5** — reencaje al girar en el editor.
6. **C6** — (si D14) pestañas del Viewer a 44 px con dedo.
7. Documentación: `docs/index.html` (apaisado, crear → colocar), `.ai/DECISIONS.md` (162+), `.ai/ARCHITECTURE.md` (§ 018.19), `CONTRIBUTING.md` si cambia el mapa. `sw.js` `CACHE` v78.

## Fuera de alcance

A **018.20** (panel de escritorio y densidad):

- Panel de propiedades de escritorio: control de color compacto, controles visuales, plegado sin selección (C9 de 018.18, D15).
- Densidad y navegación general del escritorio; «Animación del lienzo» al popover «Lienzo» en escritorio.
- Rail de escritorio en ventanas bajas: comprobar si el mismo desbordamiento aparece con ratón en alturas cortas (aquí solo se corrige el teléfono).

**Deuda posterior (018.21+)**:

- Rediseño del editor de la frase del evento (segmentos, inserción, lectura como frase).
- Los símbolos sugeridos del evento son emojis (💵 📦 👤 📨): son contenido del usuario (decisión 126), pero la selección por defecto es decorativa; revisar con la iconografía.
- Agrupar las formas del rail en un desplegable (alternativa a desplazar el rail).
- «Encajar» en el teléfono (vertical y apaisado): hoy solo pellizco y reencajes automáticos.
- Navegación «atrás» del sistema (History API) para salir de colocación, hojas o Present.
- Present en vertical en dos filas (106 px) y seguimiento del destino activo en el Viewer vertical.
- Teclado virtual y `dvh` reales en iOS/Android: QA manual en dispositivo físico.
- Lo pendiente de 018.18: `prefers-reduced-motion` en los puntos de flujo, Viewer con la interfaz oscura, `confirm`/`alert` nativos restantes, `require` de Playwright en las suites antiguas, `fluyo-011-browser` (fallos previos).

No se toca en ningún caso: `model.js`, formato, kernel, MCP, `story-clock.js`, render, semántica de eventos o de Historias, escenarios.

---

## Plan de implementación

Orden exacto; cada paso termina con su comprobación dirigida antes del siguiente.

1. **Tests primero (esqueleto)**: crear `test/fluyo-018-19.test.cjs` y `test/fluyo-018-19-browser.cjs` con los casos de § Plan de testing marcados como pendientes; fijar el alcance contra `HEAD` (archivos que no deben cambiar).
2. **C4 — gesto de colocación** (`editor-scenarios.js`: `scCanvasPlacementPointer` deja pasar el dedo y guarda el inicio; nuevo `scCanvasPlacementTap` resuelve en el `pointerup`; `interaction.js`: el gancho del `pointerup`). Comprobar: unitarias del gesto + caso Chrome «colocar con dedo» en 390 y 844.
3. **C3 — crear → colocar** (`scSaveEventType`, `scUpdatePlacementBar` con `origin`, `scNotice` según puntero, foco). Comprobar: unitarias de Undo (2 entradas, cancelar deja el evento), Chrome «crear → colocar», «cancelar creación», «Undo del evento», «Historia después de crear».
4. **C2 — diálogo** (`index.html` del diálogo, CSS del diálogo en `styles.css`, `scOpenEventDialog`/`scEditorLayout` para el plegable y su resumen, Intro en el Nombre). Comprobar: objetivos y pantallas en los cinco viewports; ids conservados; `017-3` y `015` dirigidos.
5. **C1 — apaisado** en este orden: (a) predicados `isSheetLayout`/`isSideSheet` y `placeChrome` (páginas y modos a la barra superior, Exportar y Lienzo a «Más»); (b) CSS del bloque apaisado (barra superior, sin barra inferior, rail desplazable, documento sin desbordar); (c) hoja lateral de Propiedades y `visibleCanvasRect` por la derecha; (d) hoja lateral de Historias con la cabecera de dos filas; (e) franja de reproducción y «Línea de tiempo»; (f) avisos, barra táctil y barra de colocación en la zona libre. Comprobar tras cada sub-paso en 844 × 390 y 812 × 375; al final, 390/375/768 sin cambios.
6. **C5 — reencaje al girar** (`placeChrome`/`matchMedia` + `diagramCut`). Comprobar: giro 390 × 844 ↔ 844 × 390 en Editar y en Historias.
7. **C6** (si D14) — regla de `share.css`. Comprobar: Viewer 844 × 390.
8. **Release**: `sw.js` `CACHE` v77 → v78 (sin archivos servidos nuevos), `docs/index.html`, `.ai/DECISIONS.md`, `.ai/ARCHITECTURE.md`.
9. **Verificación final**: unitarias relacionadas → Chrome 018.19 completo → regresión dirigida → mutaciones (§ Plan de testing) → QA manual por pasos con capturas → handoff en esta tarea → **READY FOR COMMIT** (sin commit).

Condiciones de parada (avisar antes de seguir): necesitar cambiar `model.js`, el formato, el kernel, el MCP o `story-clock.js`; que C4 obligue a reescribir la entrada de `interaction.js` más allá de un gancho; que la hoja lateral obligue a un segundo cálculo de zona libre.

## Plan de testing

Principio: cada slice valida lo suyo y lo que comparte código con él. Nada de la batería histórica completa.

### Unitarias (`node --test` solo de los archivos listados)

- **Nuevo `test/fluyo-018-19.test.cjs`** (estático + vm con el arnés del editor real de 016/018.8):
  - alcance frente a `HEAD`: `model.js`, `config.js`, kernel, `story-clock.js`, `render.js`, `geometry.js`, `export.js`, `viewer.js` idénticos; `CACHE` v78 y precache completo;
  - ids del diálogo y de colocación conservados;
  - CSS: media query del apaisado corto con `pointer:coarse`; rail con `overflow-y:auto` en ese bloque; `#bottomBar` oculto; objetivos del diálogo (`--ctl-h-touch`) con dedo;
  - `isSheetLayout()`/`isSideSheet()` con `matchMedia` simulado (vertical, apaisado corto, tableta, escritorio);
  - `placeChrome`: `#pagesBar` y `#modeBar` van a la barra superior en apaisado corto y vuelven a `#bottomBar` al salir; ids intactos;
  - `visibleCanvasRect()` descuenta la hoja lateral por la derecha y la franja por abajo;
  - `scSaveEventType` (crear): `scPlacement` = {kind:"place", eventTypeId: nuevo, origin:"created"}; (editar): sin colocación; (duplicar): según D9;
  - Undo: crear = +1 entrada; colocar = +1; deshacer ×2 vuelve a 0 eventos nuevos y 0 Steps nuevos; cancelar la colocación deja el evento y no toca la Historia;
  - gesto: función pura toque/arrastre (umbral 8 px, un solo puntero) y que un toque en el vacío no cancela con dedo y sí con ratón (D11);
  - texto del aviso sin «Arrástralo» con puntero grueso.
- **Relacionadas que se ejecutan** (comparten el código tocado): `fluyo-018-18.test`, `fluyo-018-17.test`, `fluyo-017-3.test`, `fluyo-017-3-qa.test`, `fluyo-018-7d.test` (biblioteca en Undo), `scenario-ui-dom.test`, `fluyo-011-final-fixes.test`, `fluyo-015.test`.

### Chrome 018.19 (`test/fluyo-018-19-browser.cjs`)

Viewports: **390 × 844, 844 × 390, 375 × 812, 812 × 375, 768 × 1024** (+ 667 × 375 si D15). Dedo en todos. Interfaz clara; la oscura solo en 844 × 390 (una pasada). Un fixture (`fluyo-017-1-qa-complejo`). `ONLY=<viewport>` para recorrer una parte (lo usan las mutaciones). Objetivo de duración: **< 3 min** la pasada completa.

| Caso | Qué se afirma (números) |
|---|---|
| Layout | apaisado: `isSheetLayout()` verdadero, sin `#bottomBar`, barra superior 44–52 px en una fila, lienzo ≥ 78 % sin selección; 0 desbordamiento del documento (`scrollHeight` = alto) también con el foco en la última herramienta del rail; la última herramienta se alcanza desplazando el rail con el dedo. Vertical y 768: lienzo y cajas iguales a 018.18 (± 1 %) |
| Abrir Propiedades en apaisado | sin selección no hay hoja; seleccionar + ⚙ abre la hoja derecha de 320 px; la selección queda entera en la zona libre; ≤ 1,3 pantallas; ✕, ⚙ y tocar el vacío la cierran |
| Abrir Historias en apaisado | hoja lateral; «Volver a editar» visible; línea de tiempo ≥ 150 px y ≥ 1 paso entero; lienzo ≥ 50 %; un solo desplazable |
| Crear evento con dedo | «+ Crear evento» → diálogo; Nombre en el primer tercio; ✕/Cancelar/Crear ≥ 44; 0 controles < 40; pantallas ≤ 1,0 (vertical) y ≤ 1,4 (apaisado) |
| Cancelar creación | Cancelar, ✕ y Escape: `doc.eventTypes`, Steps y `undoStack` iguales |
| Crear → colocar | tras «Crear»: colocación en curso con el evento nuevo, sin tocar la ficha; la barra no está tapada por ningún aviso; un arrastre de 80 px en el vacío **mueve la vista y no cancela**; un toque en el vacío no cancela; un toque en un nodo crea el Step |
| Undo del evento | ↶ quita el Step; ↶ quita el evento; ↷ ×2 lo devuelve; el documento final = el de antes del Undo |
| Historia después de crear | el Step nuevo está al final con su tiempo («1 s después»), su fila se ve en la hoja/columna, y Reproducir lo recorre (el rótulo del momento lo nombra) |
| Present | apaisado: lienzo ≥ 90 %, mando en una fila, Reproducir → `playing`; un toque no navega (contrato de 018.18) |
| Navegación de páginas | apaisado: el selector está en la barra superior, abre la lista, cambia a la página 2 y vuelve; colocando, cambiar de página cancela la colocación |
| Giro | 390 × 844 → 844 × 390 → 390 × 844 en Editar y en Historias: el diagrama que cabía sigue entero; un zoom elegido no se toca |
| Reproducir en apaisado | franja de una fila ≤ 72 px; lienzo ≥ 68 %; «Línea de tiempo» abre la hoja con la fila activa visible |
| Consola | 0 errores en todos los recorridos |

### Regresión dirigida (solo esto)

- `fluyo-018-18-browser` con `ONLY=m390,m375,l844,l812,t768` (transporte, Present, Viewer, páginas en el teléfono). Sus casos de apaisado del editor **se adaptan** a C1 con la misma intención (anotados «018.19»).
- `fluyo-018-17-browser` con los mismos viewports (hojas, zona libre, estados de Historias); su caso 844 × 390 se adapta.
- `fluyo-017-3-browser` (diálogo de evento, Undo/Redo de la biblioteca) y `fluyo-015-browser` (vista previa del diálogo): comparten el diálogo.
- `fluyo-018-12-browser`, solo su recorrido de colocación con el dedo (`ONLY` o filtro por caso): comparte el gesto.
- Si D14: `fluyo-018-14a-browser` solo en el Viewer apaisado.
- No se ejecuta el resto de la batería de Chrome salvo que algún caso dirigido falle por una causa compartida.

### Mutaciones (`test/fluyo-018-19-mutations.cjs`)

Sobre copias del árbol; la copia sin mutar en verde antes de mutar. Estáticas/vm (U) y en Chrome con `ONLY=` (B):

| # | Mutación (el bug que 018.19 evita) | La detecta |
|---|---|---|
| U1 | se quita `pointer:coarse` de la media query del apaisado | test CSS |
| U2 | `isSheetLayout()` vuelve a mirar solo la anchura | vm de predicados |
| U3 | `placeChrome` no sube `#pagesBar`/`#modeBar` en apaisado | vm |
| U4 | `visibleCanvasRect()` ignora la hoja lateral | vm |
| U5 | `scSaveEventType` sin `scBeginPlacement` | vm crear → colocar |
| U6 | entra en colocación también al editar | vm |
| U7 | crear y colocar en una sola entrada de Undo / `pushUndo` de más | vm Undo |
| U8 | un toque en el vacío con dedo vuelve a cancelar | vm gesto |
| U9 | el aviso vuelve a decir «Arrástralo» con el dedo | vm |
| U10 | `CACHE` sin subir | test de release |
| U11 | `model.js` o el kernel tocados | alcance |
| B1 | el rail vuelve a `overflow:visible` en apaisado | 0 desbordamiento del documento |
| B2 | `#bottomBar` visible en apaisado | lienzo ≥ 78 % |
| B3 | Propiedades visible sin selección en apaisado | caso Propiedades |
| B4 | la hoja de Historias conserva la fila «MODO HISTORIA» / biblioteca vertical | línea de tiempo ≥ 150 px |
| B5 | reproduciendo, la hoja lateral se queda | lienzo ≥ 68 % |
| B6 | el arrastre durante la colocación no desplaza | caso crear → colocar |
| B7 | el aviso tapa la barra de colocación | solape aviso/barra = 0 |
| B8 | objetivos del diálogo a 29 px | ✕/Cancelar/Crear ≥ 44 |
| B9 | «Cómo viaja» abierto por defecto | pantallas ≤ 1,0 (vertical) |
| B10 | la vista previa vuelve a ir primero | Nombre en el primer tercio |
| B11 | sin reencaje al girar | caso Giro |
| B12 | Escape deja de cancelar la colocación | caso cancelar |

Las mutaciones de 018.17 y 018.18 que tocan hojas, zona libre o Present se ejecutan solo si sus archivos objetivo cambian (lo harán `ui.js` y `styles.css`): estáticas completas (rápidas) y en Chrome solo las de apaisado.

## CACHE

**Sí habrá cambio: `fluyo-static-v77` → `fluyo-static-v78`.** Cambian archivos servidos y precacheados: `index.html` (diálogo, `enterkeyhint`), `css/styles.css` (apaisado, diálogo), probablemente `css/system.css` (objetivos del diálogo si se hace por token), `js/ui.js` (predicados, `placeChrome`, zona libre, reencaje), `js/editor-scenarios.js` (crear → colocar, gesto, aviso), `js/interaction.js` (gancho del `pointerup`), `docs/index.html` y, si D14, `css/share.css`. **Sin archivos servidos nuevos**: el precache no cambia de lista. Verificación: la v78 se instala, borra la v77 y el editor abre sin red (caso SW del browser test).

## Riesgos

- **Touch — gesto de colocación (C4)**: distinguir toque de arrastre en el `pointerup` puede chocar con el pellizco (el primer dedo de un pellizco no debe resolver) y con la detección de doble toque. Mitigación: resolver solo con un único puntero activo en todo el gesto y < 8 px; casos de Chrome con arrastre, pellizco y toque. El ratón no cambia (D11).
- **Touch — objetivos del diálogo**: 44 px en segmentados de tres opciones a 375 px de ancho (≈ 110 px cada uno) caben; «Rastro marcado» puede partir línea: se mide y, si no cabe, el texto se acorta en el segmentado (no el objetivo).
- **Landscape — intersección con ≤ 700 px**: en 667 × 375 rigen a la vez las reglas del teléfono vertical y las del apaisado; el bloque apaisado debe ir después y ganar sin `!important`. Por eso D15.
- **Landscape — barras del navegador y `dvh`**: Safari/Chrome en apaisado esconden y enseñan su barra; la hoja lateral y la franja usan `100dvh`. No verificable aquí: QA en dispositivo. Muesca del iPhone: sin `viewport-fit=cover` Safari ya deja el contenido dentro del área segura (no se cambia el `meta`).
- **Landscape — barra superior llena**: con ⚙ visible el selector de página cede ~40 px a 844 y más a 667; si aun así no cabe, Presentar pasa a icono (con nombre accesible), nunca se parte en dos filas.
- **Viewer**: solo cambia con D14 (una regla CSS con `pointer:coarse`); `viewer.js` no se toca (test de alcance).
- **Present**: `placeChrome` mueve `#btnPresent` dentro de `#modeBar`, que en apaisado sube a la cabecera; Present oculta la cabecera: hay que comprobar que el mando y la salida no dependen de ese padre (caso Present en el browser test).
- **Undo**: sin cambios de mecanismo (dos entradas como hoy); el riesgo es una regresión al mover `scNotice`/foco tras crear. Cubierto por U7 y el caso «Undo del evento».
- **Eventos**: crear → colocar debe respetar `scCanPlaceEvents()` (Historias de un motor anterior) y `scValidatePlacement` (cambio de página o de Historia); los dos están cubiertos en vm.
- **Decisiones recientes que se ajustan**: 146 (cuatro estados) solo en su representación apaisada; 150 (44/40) se extiende al diálogo; 151 (reencaje) se extiende al giro; 117/118 (`placeChrome` y superficies) ganan un destino. Ninguna se revierte.
- **Churn de tests**: `018-17-browser` y `018-18-browser` (casos 844 × 390 y 812 × 375 del editor) cambian de expectativas; se adaptan con la misma intención y se anotan, como en 018.17/018.18.
- **No verificable aquí**: teclado virtual real, giro físico con barra del navegador, dispositivos con apaisado < 360 px de alto.

---

## Implementación (13 de octubre de 2026)

Decisiones del responsable: alcance completo; apaisado solo con puntero táctil (escritorio sin cambios); lienzo protagonista con hojas laterales que solo aparecen al pedirlas; reproducción como franja inferior compacta; mismo mando de 018.18; Present táctil y Viewer sin cambios de semántica; cancelar la colocación deja el evento en la biblioteca; gesto de colocación solo para el dedo; crear lleva directamente a colocar; tocar el vacío no cancela; reencaje al girar con la regla de 018.17/018.18; 667 × 375 en el browser test. No decididas explícitamente y resueltas con la recomendación de la propuesta: «Duplicar evento» no entra en colocación; el botón conserva «Crear evento»; los efectos pierden los glifos decorativos. **Viewer: sin cambios** (C6 no se hizo: no era estrictamente necesario).

Orden seguido: Fase 1 crear → colocar · Fase 2 diálogo · Fase 3 colocar con el dedo · Fase 4 apaisado · Fase 5 reencaje, cada una comprobada en Chrome antes de la siguiente.

### Qué se hizo

| Fase | Implementación |
|---|---|
| 1 · Crear → colocar | `scSaveEventType`: al CREAR (`scEventDialogMode === "create"`) entra en `scBeginPlacement(id)` con `origin:"created"`; la barra dice «X creado. Toca/Elige la conexión/el elemento donde ocurre» y cuándo se añadirá. Editar y duplicar no colocan. Sin estado nuevo de documento: el EventType se crea completo (1 Undo) y el Step nace al elegir destino (1 Undo, como siempre). Cancelar/Escape dejan el evento en la biblioteca; cambiar de página cancela. Avisos sin «Arrástralo» con el dedo (`scCoarsePointer`). |
| 2 · Diálogo | Nombre · ¿Dónde ocurre? · frase · símbolo primero; «Cómo se ve» (`#scFlowLook` ahora `<details>`, y `#scAppearance` retitulado) plegado al crear, abierto al editar si el aspecto no es el de por defecto, con resumen («Mediano · Directo · Sin rastro») y la vista previa animada dentro (`scEditorLayout` la mueve). Una columna (600 px en escritorio y tableta; pantalla completa en el teléfono); en apaisado Nombre y «¿Dónde?» en una fila. 44 px con el dedo para ✕, Cancelar, Crear, segmentados, plegables y «Ver ejemplo»; 40 para chips, inserción, símbolos y huecos de la frase; ≥ 28 con ratón. Sin subtítulo, ✕ del sprite, efectos sin glifos, oliva en lo seleccionado, Intro en el Nombre = Crear (`enterkeyhint="done"`). Mismos ids. |
| 3 · Dedo al colocar | `interaction.js`: colocando con el dedo, `pointerdown` arma un desplazamiento (`panDrag.placing`; dos dedos pellizcan) y `pointerup` resuelve solo un toque ≤ 8 px (`scCanvasPlacementTap`). `scResolveDrop(…, touch)` no cancela en el vacío con el dedo. Ratón sin cambios. |
| 4 · Apaisado | `mqSide` = `(orientation: landscape) and (max-height: 500px) and (pointer: coarse)`; `isSheetLayout()` también ahí y `isSideSheet()`. `placeChrome` sube `#pagesBar` y `#modeBar` a la cabecera (y los devuelve). CSS: el bloque «Móvil» rige también en apaisado táctil; al final, cabecera de 48 px, sin barra inferior, rail vertical desplazable, Propiedades (`min(320px, 44vw)`) e Historias (320 px) como hojas a la derecha, compacta = taller, reproducción = franja inferior de una fila («Ampliar» abre la línea de tiempo en la hoja lateral), rótulo del momento ≤ 60 % del lienzo. `visibleCanvasRect()` con `left/right`; aviso a la izquierda de la hoja; `scPlaceNow` prueba los lados si arriba y abajo tapa el destino; el menú de páginas se abre debajo si no cabe encima. |
| 5 · Reencaje | `refitOnRotate` (resize con puntero táctil y cambio de orientación): entero antes → `fitView`; acercado → mismo zoom y mismo punto en el centro; con hoja abierta → `revealAboveSheet`. Ni documento, ni selección, ni Undo. |

### Ajustes que salieron de la verificación

1. **El rótulo del momento tapaba el destino en apaisado** (regresión dirigida de 018.18 en 844/812: con el lienzo ancho el rótulo crecía). `scPlaceNow` prueba posiciones laterales y en apaisado el rótulo mide ≤ 60 %.
2. **«Ampliar» en pausa no traía la fila del momento** (en pausa no hay fotogramas que la sigan; también afectaba a la hoja vertical desde 018.18): `setStoryExpanded(true)` llama a `scFollowActive` en el siguiente cuadro.
3. A 667 px la hoja de Propiedades de 320 px partía la barra táctil en dos filas: Propiedades pasa a `min(320px, 44vw)` y la barra táctil se limita a la zona libre.
4. La zona libre contaba la hoja apartada durante la colocación; ya no.
5. En modo Historia el lienzo dejaba una franja crema de 8 px a la izquierda (`body.storyMode .stage{padding-left}`, pensado para escritorio): se quita en apaisado. En vertical sigue (deuda menor, preexistente).
6. El ancho de 600 px del diálogo pisaba la pantalla completa del teléfono: solo se aplica fuera de ella.

### Archivos modificados (implementación)

Producto (servidos): `js/editor-scenarios.js`, `js/ui.js`, `js/interaction.js` (dos ganchos), `index.html` (solo el diálogo), `css/styles.css`, `docs/index.html` (dos párrafos), `sw.js` (`CACHE` v78; sin archivos servidos nuevos).
Documentación: `.ai/DECISIONS.md` (162–167), `.ai/ARCHITECTURE.md` (§ 018.19), esta tarea.
Tests nuevos: `test/fluyo-018-19.test.cjs`, `test/fluyo-018-19-browser.cjs`, `test/fluyo-018-19-mutations.cjs`.
Tests adaptados (misma intención, anotados «018.19»): pin `fluyo-static-v77 → v78` en 27 archivos; `fluyo-018-17.test` (resta de la hoja en `visibleCanvasRect`), `fluyo-018-7d.test` (Undo antes de crear), `fluyo-018-18-browser` (apaisado: franja de reproducción y selector de página), `fluyo-018-17-browser` (se retira el viewport 844 × 390 de columna: su terreno lo mide `fluyo-018-19-browser`), `fluyo-015-browser` y `fluyo-015-qa-browser` (abrir «Cómo se ve» antes de elegir cómo viaja; tras crear, colocación y Escape).

**Sin tocar** (test de alcance contra HEAD y `git status`): `js/model.js`, formato, kernel (`config`, `safe-svg`, `model`, `scenario-engine`, `scenario-playback`, `story-playback`, `document-integrity`, `story-authoring`), `story-clock.js`, `render.js`, `geometry.js`, `export.js`, `state.js`, `selection.js`, `present-story.js`, Viewer (`viewer.js`, `s/`, `share.css`), Share, `system.css`, `identity.css`; `fluyo-mcp` sin cambios; semántica de Scenarios e Historias intacta; panel de escritorio (018.20) intacto.

### Métricas antes → después (Chrome real, fixture complejo)

| Medida | Antes (v77) | Después (v78) |
|---|---|---|
| Lienzo editando, 844 × 390 / 812 × 375 / 667 × 375 | 48 / 46 / — % | 83 / 82 / 81 % |
| Barras de chrome en apaisado | 51 + 45 px (25 %) | 48 px |
| Desbordamiento del documento al enfocar el rail (844 / 812) | 197 / 212 px | 0 |
| Herramientas del rail alcanzables con el dedo en apaisado | 8 de 11 | 11 de 11 |
| Propiedades en apaisado | columna de 216 px siempre; 4,5 pantallas | hoja lateral solo al pedirla; 1,1–1,2 pantallas |
| Historias en apaisado: lienzo · línea de tiempo | 45 % · 79 px, 0 pasos | 53 % · 155 px, ≥ 1 paso |
| Reproduciendo en apaisado | 45 % | 73 / 71 % (franja de 57 px) |
| Diálogo: pantallas de scroll (390 / 375 / 844 × 390 / 812 × 375 / 667 × 375) | 1,31 / 1,43 / 3,12 / 3,31 / — | 1,0 / 1,0 / 1,58 / 1,67 / 1,67 |
| Diálogo: «Nombre» empieza en (390 / 375) | y = 272 | y = 97 |
| Diálogo: controles < 44 px con el dedo | 41 de 43 (✕ 29, Crear 29) | 0 < 40; críticos y segmentados 44 |
| Tras «Crear evento» | sin colocación; «Arrástralo…» | colocando ese evento, barra que lo explica |
| Colocando: arrastrar / tocar el vacío con el dedo | cancela / cancela | desplaza / no cancela |
| Girar 390 × 844 ↔ 844 × 390 | sin reencaje (cortado) | reencaja; acercado conserva zoom y centro |
| Escritorio 1440 × 900 (editar, Propiedades, Historias) frente a HEAD | — | 0 píxeles distintos |
| Present en apaisado | 93 %, una fila | igual |

### Pruebas

- **Unitarias** (solo las relacionadas): `fluyo-018-19.test` (13) + `018-18`, `018-17`, `017-3`, `017-3-qa`, `018-7d`, `scenario-ui-dom`, `011-final-fixes`, `015`, `016`, `018-12`, `018-13`, `018-14b` y las que fijan `CACHE` (`010-qa`, `013`, `014`, `018-10`, `018-14a`, `018-15`, `018-16`): **422 / 422**.
- **Chrome 018.19** (`test/fluyo-018-19-browser.cjs`): **381 ✔ · 0 ✘ en 167 s** — 390 × 844, 375 × 812, 844 × 390, 812 × 375, 667 × 375, 768 × 1024 (dedo), 1440 × 900 (ratón), giro y Service Worker v78 sin red. Casos: diálogo, controles táctiles, crear → colocar, cancelar (diálogo y colocación), Undo/Redo, mover el lienzo durante la colocación con un destino que empieza fuera de la vista, Historias y Propiedades en apaisado, reproducción (franja, Pausar, Ampliar, rótulo sin tapar), Present, páginas y giro.
- **Regresión dirigida** (solo esto): `018-18-browser` m390 60, m375 60, l844 61, l812 61, t768 61, d1440 61 (0 ✘); `018-17-browser` m390 97, m375 97, t768 46, d1440 46 (0 ✘); `018-12-browser` m390 64 y t768 51 (0 ✘); `018-14b-browser` m390 93, t768 84, d1440 84 (0 ✘); `016-browser` OK (17); `017-3-browser` OK (8); `015-browser` OK (15); `015-qa-browser` OK (13). No se ejecutó el resto de la batería histórica.
- **Mutaciones** `test/fluyo-018-19-mutations.cjs`: **13 / 13 estáticas y 15 / 15 en Chrome** detectadas (copia sin mutar en verde antes de mutar): Crear no entra en colocación (U3, B3), Cancelar elimina el evento (U4, B4), editar/duplicar coloca (U5), tocar el vacío cancela (U6, B6), arrastrar no desplaza (B7), el dedo se decide al apoyar (U8), diálogo < 44 px (U9, B9), «Cómo se ve» abierto (U10, B10), apaisado = tableta (U11, B11), vuelve la barra inferior (B12), el rail desborda (B13), Propiedades tapa el lienzo (U14, B14), Historias en hoja entera reproduciendo (U15, B15), rótulo sin lados (B16), menú de páginas siempre arriba (B17), sin reencaje al girar (U18, B18), «Ampliar» en pausa sin fila (B19), `CACHE` (U1), `model.js` (U2). Regresión estática: 018.17 20/20, 018.18 24/24.
- `node --check` de `js/*.js`, `sw.js` y los tests tocados: OK. `git diff --check`: limpio (solo avisos de fin de línea de `autocrlf`).

### QA visual

Capturas (scratchpad de la sesión, no versionadas) de 390 × 844, 844 × 390, 667 × 375, 768 × 1024 y 1440 × 900 en editar, Propiedades, Historias, diálogo, colocando y reproduciendo. El escritorio no cambia (0 píxeles frente a HEAD en editar, Propiedades e Historias; el diálogo sí cambia, a propósito). El apaisado ya no es una tableta rota: lienzo a sangre, una barra, hojas laterales limpias con la misma tipografía y materiales. Sin elementos visuales nuevos salvo el resumen de «Cómo se ve»; sin marcas, logos ni «NECT».

### Fallos preexistentes / deuda

- En vertical, modo Historia deja una franja crema de 8 px a la izquierda del lienzo (preexistente; corregida solo en apaisado).
- Editor de la frase: el hueco vacío al inicio deja un sangrado (28 px con ratón, 40 con dedo) delante de «Origen»; su rediseño sigue en deuda (018.21+).
- Teclado virtual y barras del navegador reales en iOS/Android: QA en dispositivo físico (Intro en el Nombre ya crea sin cerrar el teclado).
- Por decisión de alcance no se ejecutó el resto de suites históricas de Chrome (ni `fluyo-011-browser`, con fallos previos conocidos).

## Handoff (implementación)

### Estado actual

018.19 implementado y verificado sobre `f5087c9`. **Sin commit, sin push, sin deploy.** `CACHE` v78. `fluyo-mcp` limpio.

### Próximo paso concreto

Revisión del responsable (capturas y métricas de arriba) y commit. Después, 018.20 (panel de escritorio).

---

# FLUYO-018.19 — READY FOR COMMIT

- Crear → colocar, diálogo esencial primero, colocación con el dedo (tocar coloca, arrastrar desplaza, el vacío no cancela), apaisado táctil con hojas laterales y franja de reproducción, reencaje al girar.
- Unitarias 422/422; Chrome 018.19 381 ✔ · 0 ✘ (167 s); regresión dirigida verde; mutaciones 13/13 + 15/15; `node --check` y `git diff --check` limpios; escritorio idéntico a HEAD.
- Sin tocar `model.js`, formato, kernel, MCP, Share, Viewer ni la semántica de Historias. `CACHE` v77 → v78. Sin commit, push ni deploy.
