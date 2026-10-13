# FLUYO-018.24 — AUDIT

Estado: **READY FOR REVIEW** (auditoría de consolidación UX; sin cambios de código, tests ni `CACHE`).
Fecha: 13 de octubre de 2026.
Owner/agente actual: libre (pendiente de revisión del owner).

> Repo público: solo contenido técnico del proyecto open source.
> Fuentes leídas: `AGENTS.md`, `.ai/ARCHITECTURE.md`, `.ai/DECISIONS.md` (118–187), `.ai/tasks/FLUYO-018.11.md`–`018.23.md` (resúmenes, decisiones, pendientes y riesgos). Código: `js/ui.js` (panel, segmentados, color, `kwEdit`, `edgeDotsIn`, tema, Present), `js/selection.js` (`pushUndo`, `stepHistory`, `undo`/`redo`), `js/editor-scenarios.js` (`scNewScenario`, `scNotice`, seguimiento), `js/viewer.js`, `index.html` (cabecera, rail, panel, Historias, Present), `s/index.html`.
> **Este documento es el único archivo escrito.** No se tocó código, tests, `CACHE` ni el MCP.

---

## 0. Estado de partida — aviso antes de leer el resto

**018.23 no está commiteado ni desplegado** (verificado, no inferido):

- `git log`: `HEAD` = `origin/main` = `1a9ca92` (018.22). `git ls-remote origin main` → `1a9ca92`.
- `git status`: 41 archivos modificados + 4 sin seguimiento (`.ai/tasks/FLUYO-018.23.md`, `test/fluyo-018-23*.cjs`) — es el trabajo de 018.23 en el árbol.
- Producción (`https://fluyo.space/sw.js`): `CACHE = "fluyo-static-v80"` (018.22). El árbol local tiene `v81`.

La auditoría se hizo **sobre el árbol de trabajo** (018.23 incluido), que es lo que se quería evaluar. Pero cualquier slice siguiente debe partir de **commit + deploy de 018.23**; si no, 018.24 heredaría 41 archivos sin integrar y los dos fallos de test «frente a HEAD» que 018.23 ya documentó.

## Método

- Chrome real (`channel: "chrome"`, headless), `playwright-core` **fuera del repo** (scratchpad de la sesión), árbol servido por un HTTP efímero de solo lectura, Service Worker y red externa bloqueados. Fixture `test/fixtures/fluyo-017-1-qa-complejo.fluyo.json` (2 páginas, 4 Historias) cargado en memoria.
- Un único script dirigido con los 5 recorridos pedidos + dos micro-comprobaciones (Undo con la hoja móvil; deudas `kwEdit`/`edgeDotsIn`).
- **Tiempo total en Chrome: 67,5 s** (incluye 30 s de un timeout provocado por el propio defecto de Undo, §2) **+ 6 s** de la micro-comprobación. **40 ✔ · 4 ✘** (los 4 ✘ son los defectos descritos abajo, no fallos del script).
- Un unitario ejecutado (`fluyo-018-17.test`, 1 s) para clasificar su fallo preexistente. Sin baterías históricas ni mutaciones.
- Capturas: scratchpad de la sesión, `shots24/` (`d-*` escritorio, `m-*` móvil, `h-*` Historias, `p-*` Present, `v*` Viewer, `undo-*`).

### Resultado por recorrido

| Recorrido | Pasos | Resultado |
|---|---|---|
| **1 · Editor escritorio** (1440×900, ratón) | abrir · crear nodo (rail + clic) · seleccionar · relleno y texto · Deshacer ×2 / Rehacer ×2 (botones) · plegar/abrir panel · conectar (rail + 2 clics) · puntas (segmentado) · sentido de los puntos · Ctrl+Z · tema del lienzo · interfaz oscura | Todo funciona. **Defecto**: Deshacer/Rehacer **vacían la selección** (el panel vuelve a «Nada seleccionado»). Panel plegado: lienzo 66 % → 84 %. Cada control apila un Undo, salvo `kwEdit` y `edgeDotsIn`. 0 errores de consola |
| **2 · Editor móvil** (390×844, dedo) | seleccionar (toque) · ⚙ abre/cierra/reabre la hoja · relleno · «⋯» color · Conectar (barra táctil) · selector de páginas · entrar/ampliar/salir de Historias | Todo funciona. **Defecto**: Deshacer desde la hoja **cierra la hoja** y deselecciona (§2). 0 errores |
| **3 · Historias** (1440) | crear Historia · crear evento → colocar en conexión · segundo evento en elemento · «Esperar a que llegue…» · reproducir · pausar · ⏭ · reanudar · detener · salir | Todo funciona: la espera se declara en 3 clics, la línea de tiempo la nombra, ⏭ lleva al instante visible (1100 ms), Detener vuelve a lista. 0 errores |
| **4 · Present** (1440) | entrar · reproducir · pausar · página siguiente/anterior · salir | Funciona. Detalle: el aviso «Este momento no empezará…» del editor **sigue visible dentro de Present** hasta agotar sus 4,5 s (§2, P3) |
| **5 · Viewer** (1280 y 390; giro a 844×390) | abrir `/s/#d=` · reproducir · pausar · detener · página 2 (pestañas en 1280, selector en 390) · girar | Funciona. Apaisado: lienzo 844×340 y cabecera de 50 px. 0 errores |

---

## 1. Qué está realmente bien ahora

1. **El bucle principal de Historias es completo y coherente en las tres superficies**: crear → colocar → esperar una llegada → reproducir/pausar/saltar/detener, con la misma terminología y el mismo transporte en editor, Present y Viewer (155–158, 168–173).
2. **Las dependencias de llegada se entienden sin manual**: el submenú solo ofrece envíos válidos («● Pedido · Cliente → Kafka»), la línea de tiempo dice «No empieza hasta que llegue…» y ⏭ salta al instante *visible*, no al narrativo.
3. **El panel de Propiedades habla solo de la selección** y cabe en una pantalla; cabecera con nombre/tipo/Orden/Eliminar, Apariencia primero, color en una fila, Dirección como grupo propio (018.23).
4. **Oliva = activo está unificado**: segmentados, muestra elegida, «⋯» abierto, conmutador Editar/Historias, herramienta del rail, marco de selección en el lienzo.
5. **Móvil tiene gramática propia y estable**: rail horizontal de formas, ⚙ contextual, hoja de 40dvh con su cierre, «Conectar»/«Seleccionar varios» como modos explícitos, selector de páginas, Historias en hoja compacta/ampliada, apaisado con hojas laterales.
6. **Present es un modo de lectura limpio**: lienzo a sangre, rótulo del momento arriba, una sola píldora con Historia + páginas + Salir; un toque en el lienzo no hace nada (158).
7. **El Viewer ya es el mismo producto**: papel y tinta, Playfair en el título del momento, «Abrir en Fluyo» terracota como primaria, pestañas o selector según el ancho, reencaje al girar.
8. **Tipografía con dos voces bien repartidas**: Playfair (marca, títulos, nombres de página/Historia/selección) e IBM Plex Mono (controles, metadatos, rótulos de grupo). No aparece una tercera.
9. **Chrome y lienzo como dos capas deliberadas** (124): el lienzo enmarcado sobre papel hueso; la terracota reservada a Presentar/Reproducir/Abrir.
10. **Robustez**: 0 errores de consola en los 5 recorridos y en ambos temas de interfaz.

## 2. Problemas que siguen siendo reales

| # | Clase | Problema | Evidencia |
|---|---|---|---|
| **R1** | **P1** (móvil) · **P2** (escritorio) | **Deshacer/Rehacer pierden la selección.** `stepHistory` (`js/selection.js:244`) llama a `clearSel()` en cada entrada. En escritorio el panel salta a «Nada seleccionado»; en móvil **la hoja de Propiedades se cierra**. El bucle «probar un color → no me gusta → deshacer → probar otro» obliga a reseleccionar cada vez, y en el teléfono además a reabrir la hoja | Chrome: `antes {sel:1, hoja:abierta}` → color → Deshacer → `{sel:"", hoja:cerrada, título:"Propiedades"}` (390); en 1440 `{sel:"", título:"Propiedades"}`. Captura `d-05-direccion.png`: tras Ctrl+Z del sentido, panel vacío. No hay decisión que lo pida: es simplificación de origen |
| **R2** | **P2** | **`#kwEdit` (palabras clave de `code`) y `#edgeDotsIn` (número de puntos) escriben sin `pushUndo`.** Su cambio se funde con la acción anterior: Ctrl+Z deshace *juntos* «punteada» y «5 puntos»; y como no vacían Redo, escribir tras un Deshacer y pulsar Rehacer **pisa lo escrito** | Chrome: `edgeDotsIn` 5 → Undo 8→8; Ctrl+Z `[5, punteada] → [2, continua]`. `kwEdit` «foo bar» → Undo 1→1; Ctrl+Z vuelve a `lang:"sql"` de golpe. Código: `ui.js:320` y `ui.js:573`; el patrón correcto ya existe (`lblDirty`/`fsDirty`, `ui.js:472–488`) |
| **R3** | **P2** (percepción) | **Diálogos nativos del navegador** para lo destructivo y los errores: `confirm()` en eliminar Historia, eliminar elementos usados por una Historia, eliminar página y limpiar página; `alert()` en ~12 errores (importar, GIF, imagen, cuentagotas). Es la única superficie que sale del sistema visual: caja gris del navegador con «fluyo.space dice…» | `selection.js:116,170`, `editor-scenarios.js:417`, `ui.js:723`, `export.js` ×6, `interaction.js` ×3. La decisión 91 ya lo declara «provisional». Frecuencia baja (solo acciones destructivas con impacto o errores) |
| R4 | P3 | El aviso de Historias (`#scNotice`, 4,5 s) **no se oculta al entrar en Present**: se ve sobre la presentación | `p-02-reproduciendo.png`; `scNotice` no se limpia en `enterPresent` |
| R5 | P3 | El tooltip del botón «Lienzo» se queda encima de la cabecera del menú recién abierto | `d-06-lienzo-menu.png` |
| R6 | P3 | Viewer 390: el selector de página corta el nombre a media letra («01 · Pago comp») en vez de con «…» | `v390-02-play.png` |
| R7 | P3 | Móvil: «⋯» de color despliega 58 muestras (290 px) dentro de una hoja de ~340 px; usable, pero la hoja pasa a ser solo color | `m-04-color.png` (diseño aprobado en 018.23 D4/D9) |
| R8 | P3 / deuda | Bordes de campo < 3:1 (WCAG 1.4.11) en ambos temas | Ya registrado en 018.23 («revisión global de tokens») |
| R9 | P3 / deuda de tests | `fluyo-018-17.test` #8 falla en `HEAD`: aserción **de texto fuente** sobre `scFollowActive` que quedó desfasada; no es un defecto de UX (el seguimiento funciona en Chrome) | `node --test test/fluyo-018-17.test.cjs` → #8 «solo al cambiar de paso…» |

**No hay P0.** Ningún recorrido se bloquea.

No se clasifican como problema (decididos y coherentes): el tema del lienzo fuera de Undo (82, 100, 107), el lienzo oscuro por defecto (124), el «id N» en la cabecera de la selección (lo usan el MCP y los tests), la herramienta «Conectar» que se queda activa en el rail tras conectar, la hoja móvil que no se abre sola al tocar un nodo (149, M1–M3).

## 3. Lo que NO debemos tocar

Suficientemente bien; no reabrir sin evidencia nueva:

- **Panel de Propiedades de 018.23**: estructura, orden de grupos, cabecera de selección, color de una fila + «⋯», segmentados, anchos 288/216, plegado manual (180–186).
- **Historias como modo** (131), sus cuatro estados en móvil (146–148), el diálogo de evento «lo esencial primero» (166), crear → colocar (164–165).
- **Transporte y terminología únicos** (Reproducir · Pausar · Reanudar · Detener · Repetir) en editor, Present y Viewer (155–158).
- **Dependencias de llegada**: dato, UX del submenú, nota en la línea de tiempo, semántica E2 (168–179).
- **Present**: lienzo a sangre, píldora única, toque inerte (158).
- **Viewer**: chrome, pestañas/selector, banda de Historia, reencaje (130, 159, 167).
- **Cabecera de tres zonas** (135), **rail solo icono** (137), **hojas móviles** (138, 149, 150), **apaisado con hojas laterales** (162–163), **páginas sin ✕** (160).
- **Sistema visual**: tokens de `system.css`, Playfair + Plex Mono (123–125), sprite de iconos de un trazo (126), oliva/terracota/grafito, marcas del editor por tema (127).
- **Color del documento** (140–142) y **gramática de conexiones** (143–145, 161).
- **Tema del lienzo fuera de Undo** y **lienzo oscuro por defecto** (82, 124).

## 4. Últimas deudas de UX

Máximo 5; ordenadas por valor/esfuerzo.

| # | Problema | Evidencia | Impacto | Esfuerzo | ¿Ahora? |
|---|---|---|---|---|---|
| **1** | **Undo/Redo vacían la selección** (y cierran la hoja móvil) | R1: Chrome 390 y 1440; `selection.js:244` | Alto: toca el bucle más frecuente de la edición (probar → deshacer → probar). En móvil es el defecto más visible que queda | **S** (½ día): reseleccionar los ids que siguen existiendo en la página restaurada; la hoja se queda si queda selección. Ids estables por diseño (104: contadores que nunca bajan) | **Sí** |
| **2** | `kwEdit` y `edgeDotsIn` sin entrada de Undo | R2 | Medio-bajo: dos campos poco frecuentes, pero el fallo es *silencioso* (Undo se lleva otra acción; Redo pisa lo escrito) | **XS**: el patrón `lblDirty`/`fsDirty` ya existe | **Sí, con la 1** (mismo tema, mismo archivo, mismas pruebas) |
| **3** | Diálogos nativos (`confirm`/`alert`) | R3 | Medio en percepción, bajo en frecuencia: lo destructivo y los errores son justo donde el producto debe parecer más cuidado | **M**: componente de confirmación del sistema (async), ~6 llamadas destructivas + ~12 avisos; churn en suites que hoy aceptan `page.on("dialog")` | **No ahora**: slice propio cuando se toque producto (o como primera tarea de pulido de la próxima etapa) |
| 4 | Aviso de Historias visible en Present | R4 | Bajo (4,5 s, solo tras declarar algo) | XS (ocultar `#scNotice` al entrar en Present) | Opcional; no justifica slice |
| 5 | Contraste de bordes de campo (WCAG 1.4.11) | R8 | Bajo-medio (accesibilidad) | S–M (revisión global de tokens, ambos temas, capturas) | No ahora; revisión de tokens aparte |

## 5. Keywords y puntos sin Undo

**Decisión: resolver ahora, dentro de 018.24** — junto a la deuda 1, no como slice aislado.

- Por sí solos serían «dejar como deuda»: dos campos de uso bajo.
- Pero el fallo es silencioso (Undo se lleva *otra* acción; Redo pisa lo escrito), el arreglo es XS y calcado de `lblDirty`/`fsDirty`, y comparte archivo (`ui.js`), pruebas y verificación con la deuda 1. Hacerlo aparte costaría más en pruebas que en código.
- Si el owner descarta 018.24 (elige C), pasan a **deuda registrada** sin urgencia: no rompen datos guardados ni el formato.

## 6. Visual North Star

**Alineado.** Fluyo ya se siente como una herramienta editorial de papel y tinta, no como un editor de diagramas genérico:

- **Composición**: lienzo enmarcado sobre papel hueso (escritorio) y a sangre (móvil, Present); cabecera de tres zonas con una sola primaria terracota; panel sobrio con rótulos de grupo en mono versal pequeña.
- **Tipografía**: Playfair da la voz (marca, nombre de la selección, título de la Historia y del momento, nombres de página); Plex Mono hace el trabajo. Consistente en editor, Present y Viewer.
- **Color**: crema/tinta/terracota/oliva usados con disciplina: terracota = acción principal (Presentar, Reproducir, Abrir en Fluyo), oliva = activo, grafito = secundario. El interfaz oscuro conserva la misma jerarquía.
- **Iconografía**: un trazo, coherente entre rail, cabecera, panel y transporte.
- **Restos de draw.io**: no quedan en la interfaz. Lo único que recuerda a una herramienta antigua son los **diálogos nativos** (R3). El azul `#6a9fb5` de los nodos del fixture es **contenido de documentos antiguos** (140: sin migración), no la interfaz; un nodo nuevo nace en piedra.
- **Identidad sin marca añadida**: la identidad sale de tipografía, color y composición. No hay «NECT» en ninguna parte y no se propone añadirlo. El Viewer firma «Hecho con Fluyo» (atribución del producto, ya existente).

Desalineación que merece atención: **solo R3** (diálogos nativos), y no es urgente. No se propone ningún rediseño.

## 7. Recomendación PO

**A — hacer un último slice UX**, pequeño y explícitamente **el último de esta etapa**; después, **B**.

Por qué A y no C: el defecto R1 está en el gesto más repetido del editor (Deshacer) y en móvil cierra la superficie desde la que se estaba editando. Es la última fricción que se nota *en uso normal*, no en un rincón; y cuesta medio día. Cerrar la etapa (C) con eso dentro dejaría el bucle editar/deshacer —el que más define si una herramienta «se siente sólida»— por debajo del resto del producto.

Por qué no más que eso: todo lo demás que queda es P3 o de baja frecuencia (R3 se hace mejor junto con trabajo de producto que toque esos flujos). Con 018.24 cerrado, la interfaz debe congelarse: lo listado en §3 no se reabre y el siguiente trabajo es producto/funcionalidad.

**Requisito previo**: commit y deploy de 018.23 (§0).

## 8. Propuesta 018.24 — «Deshacer sin perder el contexto»

**Objetivo**: que Deshacer/Rehacer devuelvan el documento **sin sacar al usuario de lo que estaba editando**, y que cada campo del panel tenga su propia entrada de Undo.

### Incluye

1. **Selección que sobrevive a Undo/Redo** (`js/selection.js`, `stepHistory`): antes de aplicar la entrada se guardan los ids seleccionados (`selN`, `selE`) y la página activa; después, si la página restaurada es la misma, se vuelven a seleccionar los ids **que siguen existiendo**; si no queda ninguno (p. ej. se deshizo una creación) o la entrada cambió de página, se deselecciona como hoy. El panel se repinta con `refreshPanel` (valores restaurados).
2. **Hoja móvil**: si queda selección, la hoja de Propiedades sigue abierta; si no, se cierra como hoy.
3. **`#kwEdit` y `#edgeDotsIn`**: una entrada de Undo por ráfaga de escritura (`kwDirty`/`dotsDirty`, mismo patrón y mismo punto de reinicio que `lblDirty`/`fsDirty`).

### No incluye

Diálogos nativos (R3), aviso en Present (R4), contraste (R8), selección de Steps en la línea de tiempo, Undo del tema, cambios en `model.js`, kernel, formato o MCP.

### Archivos y CACHE

`js/selection.js`, `js/ui.js`, `sw.js` (`v81` → `v82`, contando con 018.23 publicado en `v81`). Sin cambios en `index.html`, CSS, Viewer, kernel ni fluyo-mcp.

### Pruebas (dirigidas)

- Unitario (`test/fluyo-018-24.test.cjs`): `stepHistory` restaura selección filtrada; `kwEdit`/`edgeDotsIn` con su bandera.
- Chrome (`test/fluyo-018-24-browser.cjs`, d1440 + m390, < 30 s): color → Deshacer conserva selección y valor restaurado en el panel; en 390 la hoja sigue abierta; Deshacer una creación deja sin selección y sin errores; Deshacer tras cambiar de página no selecciona en la página equivocada; `edgeDotsIn` y `kwEdit`: una entrada por ráfaga, Ctrl+Z no se lleva la acción anterior, Rehacer no pisa lo escrito.
- Mutaciones (~6): sin restaurar selección · restaurar ids que ya no existen · selección en otra página · hoja que se cierra con selección · `dotsDirty` sin reinicio · `kwEdit` sin `pushUndo`.

### Decisiones necesarias

| # | Decisión | Recomendación | Alternativa |
|---|---|---|---|
| **D1** | Qué queda seleccionado tras Undo/Redo | **La selección previa, filtrada a lo que sigue existiendo** (predecible, sin estado nuevo) | Seleccionar lo que la entrada cambió (más «inteligente», requiere calcular la diferencia por entrada) |
| **D2** | Hoja móvil tras Undo | **Se queda abierta si queda selección** | Cerrarla siempre (como hoy) |
| **D3** | `kwEdit`/`edgeDotsIn` | **Dentro de 018.24** (§5) | Deuda registrada |
| **D4** | R4 (aviso en Present, XS) | **Fuera** (mantener el slice cerrado en «Deshacer») | Incluirlo como una línea |
| **D5** | Después de 018.24 | **Congelar la interfaz** (§3) y pasar a producto | Otro slice de pulido (R3) |

### Riesgos

- Selección «fantasma» si un id se reutilizara: no ocurre, los contadores nunca bajan (104); igualmente se filtra por existencia.
- Interacción con Historias (Undo en modo Historia): la selección del editor no se pinta en ese modo; se comprueba que no cambia nada visible allí.
- Tests históricos que asumen selección vacía tras Undo: buscar `undo()`/`btnUndo` en las suites `*-browser` y ajustar solo las que lo afirmen explícitamente.

---

## Archivos modificados (esta auditoría)

- `.ai/tasks/FLUYO-018.24.md` (nuevo). Nada más.

## Handoff

- **Qué se hizo**: lectura de documentación y código relevante; auditoría dirigida en Chrome real (5 recorridos + 2 micro-comprobaciones, ≈ 75 s); clasificación de problemas, deudas y recomendación.
- **Próximo paso concreto**: (1) commit + deploy de 018.23; (2) revisión del owner de §7 y de D1–D5; (3) si A, implementar §8.

# FLUYO-018.24 — READY FOR REVIEW
