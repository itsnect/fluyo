# FLUYO-018.17 — Historias como superficie temporal, panel como hoja y cabecera móvil

Estado: **IMPLEMENTADO — READY FOR COMMIT** (ver el final). Decisiones D1–D8 y M1–M3 aprobadas por el responsable (D2 con la corrección de § 6.2). Sin commit, push ni deploy. `CACHE` v75 → v76.
Fecha: 8 de octubre de 2026 (auditoría y primera versión); revisión del responsable y corrección de D2 el mismo día.
Owner/agente actual: libre.

> Repo público: nada de este documento es confidencial.
> Base: `fluyo` `3fa91e8` (018.16 desplegado), árbol limpio, `CACHE` `fluyo-static-v75`.
> Fuentes leídas: `AGENTS.md`, `.ai/ARCHITECTURE.md`, `.ai/DECISIONS.md` (117–145), `FLUYO-018.11`, `018.12`, `018.13`, `018.14` (a y b), `018.15`, `018.16`; `index.html` (cabecera, rail, `aside`, barra inferior), `css/system.css` (tokens), `css/styles.css` (móvil, hojas, modo Historia, puntero grueso), `js/ui.js` (`setUiMode`, `openSurface`, `revealAboveSheet`, `sheetTapOutside`, `placeChrome`, grupos del panel), `js/editor-scenarios.js` (`scRun`/`scTick`, `scRenderPanel`, `scRenderButtons`, `scRenderNow`, `scRevealTarget`/`scTargetOffscreen`, biblioteca, paleta, colocación, `scSyncCompact`), `js/story-playback.js` y `js/present-story.js` (solo lectura: no hay pausa). Los browser tests de 018.12–018.16 como referencia del método.
> No se ha reabierto 018.16 (conexiones): ninguna dependencia directa.

---

## 0. Estado de las decisiones (revisión del responsable)

| Decisión | Estado | Nota |
|---|---|---|
| D1 Historias como modo propio | **Aprobada** | ya lo es (decisión 131); 018.17 lo completa en móvil |
| D2 Presentación móvil | **Aprobada con corrección** (§6 y §20 bis) | la hoja ampliada ya no deja un 24 % arbitrario: el lienzo sigue siendo reconocible y útil |
| D3 Reproduciendo | **Aprobada** | recuperar al máximo el lienzo y mostrar con claridad el momento y el evento activo |
| D4 Panel | **Aprobada** | bottom sheet adaptativo en móvil |
| D5 Cabecera móvil | **Aprobada** | solo acciones primarias en primer nivel |
| D6 Touch | **Aprobada** | 44 px para acciones críticas; filas con objetivo adecuado |
| D7 Desktop | **Aprobada** | no trasladar la gramática móvil; compartir solo correcciones funcionales |
| D8 Fuera de alcance | **Aprobada** | ver §18 |
| M1–M3 | **Aprobadas** | explicitadas en §19; implementadas |

---

## 1. Contexto

Después de 018.11–018.16, el chrome del editor ya tiene sistema visual, cabecera de una fila, Historias como **modo** (decisión 131) con hoja compacta/ampliada en móvil (decisión 138), bloque «Reproduciendo» (139) y panel por grupos (136). Lo que sigue abierto no es «dónde vive Historias», sino **cómo se reparte el espacio en un teléfono** una vez dentro: cuánto lienzo queda en cada estado, qué hay en la hoja, si lo que importa se ve y si la salida está siempre a mano.

Este documento no asume la auditoría de 018.11: vuelve a medir sobre el árbol actual (§3) y diseña un slice pequeño y comprobable (§6–§8) sin tocar dominio.

## 2. Problemas actuales (medidos, no inferidos)

Resumen de lo que sigue mal **hoy**, en el estado de 018.16:

1. **Historias en móvil deja el 54–58 % del lienzo y, ampliada, el 20 %.** La hoja compacta (260–280 px) gasta su altura en chrome: barra del modo (53), fila del título (50), transporte (40), «Eventos · N» (48), rótulo (13) y huecos (48). A la línea de tiempo le quedan **79 px** (menos de dos filas). Ampliada, la franja de lienzo son 162–186 px y el diagrama encajado ahí queda a zoom 0,43–0,49: los nodos miden ~30 px y las etiquetas ~6 px. Es una franja, no un lienzo.
2. **Reproduciendo, el paso en curso no está a la vista en ningún móvil.** El bloque «Reproduciendo» sí se ve (caption y 2 / 4), pero la fila activa de la línea de tiempo queda 293 px por debajo del borde de la hoja (340 en apaisado), y nada la desplaza. Además el botón «Eventos · N» sigue ocupando 48 px, deshabilitado.
3. **La hoja entera hace scroll y arrastra fuera «Volver a editar».** Al colocar un evento, `scrollIntoView` de la fila nueva desplaza también el `aside` (scrollTop 40–61 px): la barra del modo con la salida queda fuera de la hoja en 430/390/375 y en apaisado, y se queda así al reproducir después. Hay dos desplazables anidados en compacta (hoja 269/319 + línea de tiempo 79/749) y dos en ampliada (biblioteca 116/264 + línea de tiempo 117–213/749).
4. **Propiedades en móvil deja el 24–28 % del lienzo** (hoja de 52dvh: 422–485 px) aunque todos los grupos estén plegados; con «Forma y color» abierto, 1,6–2,0 pantallas. La barra táctil (Conectar · Seleccionar varios) se pinta **encima de un nodo** («Comercio») porque `revealAboveSheet` no reserva su altura.
5. **Colocando un evento: «Cancelar» mide 80 × 29 px** (el único control < 40 del recorrido) y el aviso «Historia N creada» se superpone a la barra de colocación (`#scNotice` y `#scPlacementBar` comparten la misma esquina).
6. **Tableta y apaisado cortan el diagrama al entrar en Historias**: a 768 el lienzo pasa de 488 a 452 px de ancho y el diagrama (496 px) queda cortado; igual a 844 × 390 (572 > 536). En 1280/1440 el rail que desaparece compensa la columna de 320.
7. **La barra de páginas desborda en móvil**: con dos páginas, 459 px de pestañas en 147–202 px de hueco; «＋» y la segunda pestaña no se ven y no hay indicio de desplazamiento.
8. **Objetivos táctiles**: 0 controles < 40 px (salvo «Cancelar» de colocación), pero **ninguno llega a 44**: el sistema fija `--ctl-h-touch: 40px`. En el diálogo de evento: ✕ 29 × 29, chips de frase 27 px, segmentados 24–34 px.
9. **Campos a 12–12,5 px con dedo** (panel, renombrar, diálogo): Safari iOS hace zoom al enfocar campos < 16 px.
10. **No existe pausar/reanudar** en ninguna superficie (editor, Present, Viewer): el único «Pausa» es la animación ambiental del lienzo. No es un defecto de UI: es una capacidad que no existe (§18).
11. **Sin «Encajar» en móvil**: los controles de vista se ocultan a ≤ 700 px; recuperar el diagrama depende del pellizco o de `revealAboveSheet`.
12. **Tocar un nodo en la hoja ampliada la reduce** (`sheetTapOutside` reduce con cualquier toque sin arrastre, también sobre un nodo): el lienzo no sirve para «ver de qué nodo habla este paso» sin perder la línea de tiempo.

Lo que **ya está bien** y no se toca: cabecera de una fila en los seis anchos (50–52 px); modo Historia con salida nunca bloqueada; la hoja de Propiedades se cierra con ✕, ⚙ y tocando el vacío y devuelve el lienzo al instante (77–82 %); cambiar de página en modo Historia conserva el modo y cae en la primera Historia de la página; abrir/cerrar 12 veces deja el estado limpio; escritorio (1440/1280) con columna de 320 px, fila activa visible y 0 objetivos < 28 px; 0 errores de consola en todos los recorridos.

## 3. Evidencia de Chrome

Chrome 155 real (`channel: "chrome"`, headless) con `playwright-core` instalado **fuera del repo** (scratchpad de la sesión), sirviendo el árbol tal cual con un servidor HTTP efímero de solo lectura y el Service Worker bloqueado. Táctil emulado (`hasTouch`, `isMobile`, densidad 2 en móvil) con `touchscreen.tap`; ratón en escritorio. Fixture `test/fixtures/fluyo-017-1-qa-complejo.fluyo.json` (2 páginas, 3 Historias, 6 Eventos). Scripts `a17/audit.cjs` y `a17/audit2.cjs`, resultados `results*.json` y capturas `shots/`, `shots2/` en el scratchpad (no versionado). **Ningún archivo del repo cambió salvo esta tarea.**

Recorridos A–M (abrir, cerrar, crear/editar, seleccionar evento, reproducir, pausar, cambiar de Historia, volver a editar, propiedades, editar, cerrar, cambiar de página, abrir/cerrar repetido) en 1440 × 900, 1280 × 720, 768 × 1024, 430 × 932, 390 × 844 y 375 × 812, más 844 × 390 (apaisado) en la segunda pasada. Medidas: % de pantalla que es lienzo (muestreo `elementFromPoint` cada 8 px), alto/filas/overflow de la cabecera, alto y pantallas de scroll de la hoja o columna, controles < 40 y < 44 (dedo) o < 28 (ratón), desplazables anidados con desbordamiento real, controles críticos tapados o fuera, visibilidad del bloque «Reproduciendo» y de la fila activa, estado de modo/hoja, `scrollTop` de la hoja, presupuesto de alturas de la hoja, solapes de la barra táctil con nodos, corte del diagrama al entrar en Historias, overflow de la barra de páginas, tamaño de fuente de los campos, zoom y caja del diagrama en la franja libre.

### 3.1 Lienzo visible (% de pantalla) · px de lienzo libre · alto de la hoja o columna

| Viewport | Editor | Historias compacta | Historias ampliada | Reproduciendo | Propiedades (plegado) | «Forma y color» abierto |
|---|---|---|---|---|---|---|
| 1440 × 900 (ratón) | 67 % | 68 % · col. 320 | — | 67 % | 67 % · 288 · 1,16 pant. | 1,16 |
| 1280 × 720 (ratón) | 61 % | 62 % · col. 320 | — | 61 % | 61 % · 288 · 1,49 | 1,49 |
| 768 × 1024 (dedo) | 57 % | **52 % · col. 300 · diagrama cortado** | — | 51 % | 54 % · 216 · 1,36 | 1,36 |
| 430 × 932 (dedo) | 84 % | 58 % · 548 px · hoja 280 | **20 % · 186 px · 642 · zoom 0,49** | 64 % · 608 px · 220 | **28 % · 294 px · 485** | 1,64 |
| 390 × 844 (dedo) | 82 % | 55 % · 470 px · 270 | **20 % · 169 px · 571 · zoom 0,44** | 61 % · 521 px · 219 | **25 % · 252 px · 439** | 1,82 |
| 375 × 812 (dedo) | 81 % | 54 % · 448 px · 260 | **20 % · 162 px · 546 · zoom 0,43** | 60 % · 497 px · 211 | **24 % · 237 px · 422** | 2,0 |
| 844 × 390 (apaisado) | — | col. 320 · lienzo 296 px de alto · **cortado** | — | fila activa fuera | col. 320 | — |

Cabecera: 50 px y una fila en escritorio y tableta; 52 px y una fila en los tres móviles (logo · Deshacer · Rehacer · Compartir · ⚙ · Más). Rail móvil 49 px; barra inferior móvil 52 px. Overflow horizontal: 0 en todas las celdas.

### 3.2 Presupuesto de la hoja de Historias (390 × 844; 430 y 375 difieren ≤ 10 px)

| Estado | Alto | Reparto (px) | Línea de tiempo visible |
|---|---|---|---|
| Compacta | 270 | relleno 28 · barra del modo 53 · título/+/⋯ 50 · Reproducir 40 · «Eventos · 6» 48 · rótulo 13 · huecos 48 | **79** (1,5 filas de 749) |
| Ampliada | 571 | ídem sin «Eventos·N» + biblioteca 204 (116 desplazables) | 142 (117 a 375) |
| Reproduciendo | 219 | barra del modo 53 · Detener 40 · «Reproduciendo» 62 · «Eventos · 6» 48 (inerte) · rótulo 13 | **79**; fila activa 293 px por debajo del borde |
| Tras colocar un evento | 270 | igual, pero `aside.scrollTop` = 50 (40 a 430, 60 a 375, 61 apaisado) | «Volver a editar» **fuera** de la hoja |

### 3.3 Objetivos, scroll anidado y solapes

| Medida | Escritorio (ratón, mín. 28) | Tableta / móvil (dedo, mín. 40 / 44) |
|---|---|---|
| Controles < mínimo | 0 | < 40: solo «Cancelar» de colocación (80 × 29). < 44: **todos** (21–54 por estado): el sistema fija 40 |
| Diálogo de evento | 6 < 28 (chips 27, segmentados 24) | 43 de 43 < 44; ✕ 29 × 29; campo nombre 12 px |
| Desplazables anidados en Historias | biblioteca + línea de tiempo (columna sin scroll propio) | compacta: hoja + línea de tiempo; ampliada: biblioteca + línea de tiempo |
| Críticos tapados | ninguno | `scPlacementCancel` bajo `#scNotice` (colocando); `btnStoryExit` fuera de la hoja tras colocar (430/390/375/apaisado) |
| Barra táctil sobre nodos | — | sí, sobre «Comercio» al abrir Propiedades (430/390/375/844) |
| Barra de páginas (2 páginas) | sin overflow | overflow 257 / 297 / 312 px; «＋» y la 2.ª pestaña fuera |
| Campos con dedo | — | 12–12,5 px (panel, renombrar, diálogo) |
| Pausar/reanudar | no existe | no existe |
| «Encajar» | sí (barra inferior) | no (solo pellizco) |

Capturas de referencia (scratchpad): `shots/m390-02-historias.png` (compacta), `m390-03-historias-exp.png` (ampliada), `m390-10-historia-pasos.png` (salida fuera de la hoja), `m390-11-reproduciendo.png`, `m390-15/16-*.png` (Propiedades y «Forma y color»), `m390-09-colocando.png` (aviso sobre Cancelar), `shots2/t768-compact.png` (diagrama cortado), `shots2/d1280-compact.png` y `shots/d1440-*.png` (escritorio, correcto).

## 4. Objetivo

Que en un teléfono Fluyo se sienta diseñado para el espacio disponible, con el lienzo como protagonista o, cuando la Historia manda, como contexto reconocible y útil; sin tocar el dominio:

- **Cerrada**: el lienzo es la pantalla (≥ 80 %).
- **Compacta**: el lienzo sigue siendo protagonista (≥ 70 %) y la Historia es una superficie de control.
- **Ampliada**: la Historia manda para editar y ordenar, pero el lienzo sigue siendo **reconocible y útil**: se ve el nodo o la conexión de la que habla el paso seleccionado a tamaño legible, se puede desplazar y tocar, y la línea de tiempo enseña ≥ 5 pasos. Sin porcentaje arbitrario: la altura de la hoja la decide su contenido hasta un tope que se deriva de lo que el lienzo necesita para ser útil (§6.2).
- **Reproduciendo**: el lienzo vuelve a mandar (≥ 72 %) y el evento activo se ve dos veces: en el lienzo (su destino dentro de la zona libre) y en la hoja (momento en curso).
- **Propiedades**: ≥ 45 % de lienzo con la selección a la vista y sin tapar.
- Una salida visible en cada estado; ningún gesto obligatorio; un solo desplazable por hoja; objetivos críticos de 44 px sin encoger nada para «ganar lienzo».
- Escritorio y tableta: mismo layout que hoy salvo tres correcciones funcionales (fila activa a la vista, nada inerte mientras se reproduce, reencaje al entrar en Historias).

## 5. Principios UX (aplican a este slice)

1. **El lienzo manda; la hoja se gana su altura con contenido, no con chrome.** Cada fila fija de la hoja tiene que servir a la tarea del estado en que aparece.
2. **Un estado, un contenido.** Compacta = mando (qué Historia, reproducir, salir). Ampliada = taller (línea de tiempo y eventos) con el lienzo como contexto vivo. Reproduciendo = transporte + momento en curso. Nada que no se pueda tocar en ese estado ocupa sitio.
3. **La hoja mide lo que mide la Historia, hasta el tope que el lienzo necesita.** El tope no es un porcentaje elegido: es la altura mínima en la que el lienzo cumple su función en ese estado (ver el destino del paso a tamaño legible y poder desplazarlo).
4. **El lienzo contextualiza lo que se edita.** Tocar un paso enseña su destino en el lienzo; tocar un nodo en el lienzo lo selecciona sin cerrar la Historia. El lienzo nunca se tapa del todo: ni modal ni pantalla propia.
5. **La salida se ve siempre.** «Volver a editar» pertenece a una fila fija de la hoja, fuera de cualquier scroll, en los cuatro estados.
6. **Un solo desplazable.** La hoja no desplaza; desplaza la línea de tiempo. Las ayudas de desplazamiento (`scrollIntoView`) solo mueven ese contenedor.
7. **Lo que se reproduce se lee en dos sitios coherentes**: el bloque «Reproduciendo» (resumen) y la fila activa de la línea de tiempo, que se trae a la vista sola; en el lienzo, el destino del paso activo queda en la zona libre.
8. **Sin gestos ocultos.** Ampliar/reducir con botón (ya); tocar el vacío del lienzo reduce (ya); cerrar con botón (ya). No se añade arrastre de la asa.
9. **44 px para lo que saca de un estado o lo cambia** (salir, cerrar, cancelar, reproducir/detener, modo); 40 px para filas de lista con área de toque a todo el ancho. El lienzo no se gana encogiendo controles.
10. **Escritorio no se «movifica».** Nada de hojas, asas ni botones gigantes por encima de 700 px.
11. **Calm Instrumentation**: una caja por propósito (el bloque «Reproduciendo» es la única caja), serif para el nombre de la Historia y el momento, mono para progreso y estados, filetes en vez de bordes, movimiento solo donde dice algo (altura de la hoja, punto «en vivo») y respeta `prefers-reduced-motion`. Sin marcas, sin logos, sin NECT.

## 6. Propuesta de Historias (D1 aprobada · D2 corregida · D3 aprobada)

### 6.1 Máquina de estados (móvil, ≤ 700 px)

Los cuatro estados ya existen como combinación de `uiMode`, `body.panelOpen`, `body.storyExpanded` y `body.scPlaybackOn`. El slice los **nombra y les da contenido propio** (`storyState()` en `ui.js` → `closed | compact | expanded | playing`, reflejado en `body[data-story]` para el CSS), sin cambiar las puertas (`setUiMode`, `openSurface`, `setStoryExpanded`, decisión 131).

```text
cerrado ──Historias (barra inferior)──▶ compacta ◀──⌄ Reducir / tocar el VACÍO del lienzo── ampliada
                                           │ ▶ Reproducir                       ▲ ⌃ Ampliar
                                           ▼                                     │
                                       reproduciendo ──■ Detener / fin──▶ terminada ──↻ Repetir / Volver a editar
   Volver a editar (en los cuatro estados) ──▶ cerrado + modo Editar            (⌃ Ampliar en terminada = Terminar + ampliada)
```

Jerarquía pedida: **cerrada** = lienzo protagonista; **compacta** = lienzo protagonista + superficie de control; **ampliada** = Historia protagonista, lienzo reconocible y útil; **reproduciendo** = lienzo protagonista + evento activo visible.

### 6.2 Contenido de cada estado (390 px; alturas con `--ctl-h-touch` 44)

**Compacta — «mando»** (≈ 128 px: relleno 12/16 + 2 filas de 44 + hueco 8 + asa) → lienzo ≈ 72 %.

```text
┌ ─────────────────────── asa ─────────────────────── ┐
│ Banco caído desde el inicio ▾            ⋯    ⌃     │  fila A: nombre (serif, elige Historia) · opciones · Ampliar
│ [▶ Reproducir]                   [← Volver a editar] │  fila B: transporte · salida
└─────────────────────────────────────────────────────┘
```

- Desaparecen de la compacta: el rótulo «MODO HISTORIA» (lo dice el botón «Historias» activo de la barra inferior), el botón «+» (ya está «+ Nueva historia» en el selector ▾), «Eventos · N» (colocar eventos es tarea de la ampliada) y el rótulo «HISTORIA». `#scStoryAdd` sigue en el DOM (oculto en compacta móvil) para no romper a quien lo llama.
- Si la Historia no tiene pasos, la fila B dice «Añade eventos desde Ampliar» en lugar del botón deshabilitado sin explicación (P2-10 de 018.11).
- Al entrar, `revealAboveSheet("page")` (ya existe) encaja la página en la zona libre si no se veía: con 128 px de hoja la zona libre son ≈ 600 px y el diagrama de prueba queda a zoom ≥ 0,9.

**Ampliada — «taller con el lienzo como contexto»** (D2 corregida).

Qué hay y qué altura ocupa:

```text
│ Banco caído desde el inicio ▾            ⋯    ⌄     │  fila A (44)
│ [▶ Reproducir]                   [← Volver a editar] │  fila B (44)
│ EVENTOS  [+ Crear] [💵 Pago] [⚙️ Procesamiento] [📣 … ]│  carril horizontal de chips (44), desplazable a lo ancho
│ HISTORIA                                            │  rótulo (13)
│ │ Al comenzar                                       │  ÚNICO desplazable vertical de la hoja: la línea de tiempo
│ ● ⋮⋮ 💵 Pago · Cliente paga a Kafka             ⋯  │
│ │ 500 ms después …                                  │
```

1. **Altura por contenido, con tope funcional.** La hoja mide lo que mide la Historia (`height:auto`): una Historia de dos pasos deja más lienzo que una de nueve. El tope es `max-height: calc(100dvh − cabecera − barra − var(--canvas-useful))`, donde **`--canvas-useful` no es un porcentaje elegido**: es lo que el lienzo necesita para cumplir su función en este estado, que es enseñar el destino del paso seleccionado a tamaño legible y dejarlo desplazar. Un nodo típico (100 × 60 u) a zoom 0,75 son 75 × 45 px; con una conexión de entrada y salida y margen para el dedo (44 px por lado) hacen falta ≈ 250 px, y con el rail de aire para arrastrar, **300 px**. En pantallas altas conviene que crezca con ellas, por eso `--canvas-useful: max(300px, 40dvh)`: 338 px a 390 × 844, 325 a 375 × 812, 373 a 430 × 932. Lo que se exige y se mide no es «40 %», sino lo de §16 (destino visible, legible, desplazable).
2. **Qué queda en la hoja a 390 × 844**: tope 402 px → relleno 28 + filas A/B 96 + chips 52 + rótulo 13 = 189 → **línea de tiempo ≈ 213 px (≥ 5 filas)**, frente a los 142 px de hoy con un 20 % de lienzo. Se gana en los dos lados porque desaparecen la biblioteca vertical (204 px), la barra del modo (53) y la paleta (48).
3. **El lienzo contextualiza**:
   - al ampliar, la vista se encaja en la zona libre solo si el diagrama cabe a zoom ≥ 0,6 (etiquetas ≈ 8 px, nodos ≥ 36 px); si no cabe, no se reduce el zoom por debajo de 0,6: se centra el destino del paso seleccionado (o del primero) y el resto se alcanza desplazando (`revealAboveSheet` gana un suelo de zoom y un objetivo «paso»);
   - **tocar un paso** en la línea de tiempo trae su destino a la zona libre (`scRevealTarget`, que ya existe para «fuera de pantalla», pasa a considerar «pantalla» = lienzo menos hoja, cabecera y barra táctil) y lo resalta con el oliva de activo;
   - **tocar un nodo o una conexión** en la zona libre lo selecciona y **no reduce la hoja** (hoy sí: `sheetTapOutside` reduce con cualquier toque); solo el toque en el **vacío** reduce (decisión 138, matizada);
   - desplazar con un dedo y pellizcar funcionan en la zona libre (ya);
   - colocar un evento sigue apartando la hoja entera (ya, `body.scPlacing`): el lienzo completo para elegir el destino, y al terminar vuelve la ampliada con la fila nueva a la vista dentro de la línea de tiempo (no de la hoja).
4. **Eventos como carril de chips**: mismos `.scEventRow`/`.scEventPlace`, en fila (`display:flex` + `overflow-x:auto`), «+ Crear evento» como primer chip; cada chip conserva su botón ⋯ (44 px) con el mismo menú de hoy, sin pulsación larga. La paleta flotante (`scFloating`, `#scPaletteToggle`) deja de usarse en la hoja móvil (sigue para columnas < 300 px en escritorio, su caso original).
5. **Un solo desplazable**: el `aside` pasa a `overflow:hidden` en la hoja y los `scrollIntoView` de colocar/aplicar/crear se limitan a la línea de tiempo (`scrollTo` sobre `.scStoryboardSection`).
6. **Descartado**: hoja a pantalla completa o modal (tapan el lienzo donde se colocan los eventos y donde vive el contexto); franja fija del 20–24 % (lienzo de adorno, zoom 0,44: lo que había que corregir); hoja arrastrable (gesto no descubrible, decisión 138); partir el lienzo en vertical (a 375 px no hay anchura).

**Reproduciendo — «transporte»** (≈ 128–136 px) → lienzo ≈ 72–74 % (D3 aprobada).

```text
│ ● REPRODUCIENDO                               2 / 4 │  fila A: bloque «Reproduciendo» (única caja; oliva)
│   Procesamiento · Kafka procesa el evento            │          momento en serif, una o dos líneas
│ [■ Detener]                       [← Volver a editar] │  fila B
```

- Al reproducir, `revealAboveSheet("page")` (ya) encaja la página en la zona libre (≈ 600 px): el evento activo se ve en el lienzo. Si la página no cabe a zoom ≥ 0,6, en vez de reducirla se sigue el destino del paso activo (se trae a la zona libre solo cuando no está, con un desplazamiento corto; nunca en cada fotograma).
- «Eventos · N» no se pinta mientras se reproduce (en ningún ancho; hoy sigue 37–48 px inerte).
- ⌃ Ampliar sigue disponible: ampliada + reproduciendo = transporte + línea de tiempo con la **fila activa traída a la vista** (`scTick` → si cambia el paso activo, `scrollTo` del contenedor; solo si no está visible y solo si el usuario no ha desplazado en los últimos ~2 s). En ampliada+reproduciendo rige el mismo tope de §6.2.1: el lienzo sigue mostrando el destino activo.
- Terminada: la fila A dice «Terminada · resumen»; la fila B: `[↻ Repetir] [← Volver a editar]`. En móvil **«Terminar» se retira de la fila** (no cabe con tres acciones a 375 px): lo hacen implícitamente ⌃ Ampliar (termina y abre el taller) y el selector ▾ (ya resetea); «Volver a editar» ya detiene (decisión 133). En escritorio/tableta «Terminar» sigue (decisión 132 intacta).

**Cerrada**: nada sobre el lienzo; «Historias» en la barra inferior sin marcar.

### 6.3 Escritorio y tableta (> 700 px) — D7 aprobada

- Columna de 320 px (300 en tableta, 352 ≥ 1600) **sin cambios de estructura**: barra del modo, título, transporte, biblioteca vertical y línea de tiempo.
- Tres correcciones funcionales compartidas con móvil: (1) la fila activa se trae a la vista al reproducir; (2) `#scPaletteToggle` oculto mientras se reproduce; (3) al entrar en el modo, si el diagrama queda cortado por el lienzo nuevo, se reencaja (`fitView` solo si `getBounds()` desborda el lienzo tras `setUiMode`; a 1280/1440 no se dispara porque no se corta). Nada de hojas ni barras inferiores.
- Apaisado de teléfono (844 × 390) cae en este layout por anchura: se beneficia del reencaje y del autoscroll; su columna de 320 px no se rediseña aquí (§18).

## 7. Propuesta de panel (D4 aprobada)

Móvil (≤ 700 px), hoja de Propiedades:

1. **Altura por defecto `clamp(220px, 40dvh, 360px)`** (hoy `clamp(260px, 52dvh, 560px)`): 338 px a 390 → lienzo ≈ 48 % (hoy 25 %). Si el contenido no cabe, la hoja desplaza (ya lo hace); el usuario que edita color acepta una hoja más alta durante ese grupo, pero el estado de llegada deja ver la selección y su entorno.
2. **Lo frecuente arriba, en una fila**: metadato (`Caja · id 1`), campo de texto (ya sticky) y, en la misma cabecera de la hoja, el botón de cerrar de 44 px. El grupo «Animación del lienzo» (`#grpAnim`, ajuste del DOCUMENTO) sale de la hoja de selección en móvil: viaja a «Más» › Lienzo con `placeChrome`, como ya viajan `#canvasTools` (**M1**). «Eliminar» sigue (y la papelera flotante también).
3. **Agrupación sin perder nada**: los grupos `<details>` y el acordeón se quedan; en puntero grueso las rejillas de color enseñan **una** fila (la paleta con nombre) + «Más colores», con «Personalizado» y «Cuentagotas» en la fila de 44 px que ya existe. Ningún control desaparece: toda propiedad sigue en su grupo.
4. **La barra táctil no tapa la selección**: `revealAboveSheet` descuenta la caja de `#touchBar` (y el rail) del área libre, igual que ya descuenta la hoja.
5. **Campos a 16 px con `pointer:coarse`** (textarea, inputs, selects del panel; la regla es de `system.css`, así que también alcanza al renombrar y al diálogo de evento sin tocarlos).
6. Cerrar = lienzo al instante (ya; se conserva y se afirma en el test).

Escritorio y tableta: sin cambios (288 / 216 px, grupos como en 018.14b). No se introduce la barra contextual flotante ni el control de color compacto: es otro slice (§18).

## 8. Propuesta de cabecera (D5 aprobada)

No se rediseña. En móvil ya es una fila de 52 px en 375/390/430, así que «evitar 3 filas» está resuelto desde 018.12/13; lo que se decide aquí es el **primer nivel**: solo acciones primarias.

| Control | Hoy (móvil) | Propuesta | Por qué |
|---|---|---|---|
| Logo | primer nivel | permanece | identidad y ancla |
| Deshacer · Rehacer | primer nivel | permanecen | recuperación de errores sin teclado (decisión 119) |
| Compartir | primer nivel (icono a ≤ 420) | permanece | pilar del loop |
| ⚙ Propiedades | primer nivel siempre | **contextual**: visible solo con selección en modo Editar (ya se oculta en modo Historia) (**M2**) | sin selección abre una hoja de ayuda que no edita nada |
| Más | primer nivel | permanece | Archivo, Lienzo, Interfaz, enlaces |
| Presentar · Historias | barra inferior | permanecen abajo | a mano del pulgar (decisión 117/135) |
| Ayuda del estado vacío («Nada seleccionado» + atajos) | dentro de la hoja ⚙ | pasa a «Más» › «Ayuda y gestos» (**M2**) | superficie secundaria; deja de justificar ⚙ sin selección |

Escritorio y tableta: idénticos a 018.14b (tres zonas, una fila a 1280/1101/768). Barra inferior móvil: las pestañas de página limitan su anchura (`max-width` con elipsis, nombre en serif) y «＋» queda fijo fuera del desplazable, de modo que a 375 px con dos páginas se vean ambas y el «＋». No es una navegación nueva: son las mismas pestañas con otro reparto.

## 9. Desktop vs mobile (D7 aprobada)

| | Escritorio / tableta (> 700) | Móvil (≤ 700) |
|---|---|---|
| Historias | columna fija 320/300; biblioteca vertical; «Terminar» | hoja con 4 estados; altura por contenido con tope funcional; chips horizontales; sin «Terminar» (lo hacen ▾ y ⌃) |
| Salida | «Volver a editar» en la barra del modo (ya) | «Volver a editar» en la fila B fija, en los 4 estados |
| Paso en curso | bloque + fila activa con autoscroll | bloque (compacta/reproduciendo) + fila activa con autoscroll (ampliada) + destino en la zona libre |
| Contexto del paso seleccionado | el lienzo entero está al lado | tocar un paso trae su destino a la zona libre; tocar un nodo lo selecciona sin reducir |
| Reencaje | al entrar en el modo si el diagrama queda cortado (768, apaisado) | `revealAboveSheet` con suelo de zoom 0,6 y objetivo «paso»; respeta la barra táctil |
| Propiedades | columna 288/216 con grupos (ya) | hoja de 40dvh; «Animación del lienzo» en «Más» (M1) |
| Cabecera | sin cambios | ⚙ contextual; ayuda en «Más» (M2) |
| Lo que NO se traslada a escritorio | — | hojas, asa, chips horizontales, 44 px, ocultar «+» y «Terminar», ⚙ contextual, altura por contenido, suelo de zoom |
| Lo que SÍ se comparte (correcciones funcionales) | autoscroll de la fila activa; paleta oculta al reproducir; reencaje si el diagrama se corta | ídem |

## 10. Touch (D6 aprobada)

- **44 px (`--ctl-h-touch: 44px`)** para: «Volver a editar», ✕ de la hoja, Reproducir/Detener/Repetir, ⌃/⌄ Ampliar, «Cancelar» y «Aplicar» de colocación, Historias/Presentar (barra inferior), ⚙/Más/Deshacer/Rehacer (cabecera), «＋» de páginas y chips de evento. Con la cabecera de 52 px y la barra de 52 siguen cabiendo.
- **40 px** se mantiene (`--ctl-h`) para filas de lista con toque a todo el ancho: filas de la línea de tiempo (frase 244–336 × 40), esperas, asas de reordenar, ⋯ de fila, ítems de menú y pestañas de página. Razón: subir todo a 44 encarece cada lista un 10 % y no mejora el acierto en objetivos ya anchos. **Nada se encoge para ganar lienzo**: el lienzo se gana quitando chrome inerte (barra del modo, paleta, biblioteca vertical) y dando a la hoja la altura de su contenido.
- Gestos: los actuales (toque, arrastre de nodo, pan con un dedo, pellizco, «Conectar» y «Seleccionar varios» por botón). **No se añade** arrastrar la asa ni deslizar para cerrar: ampliar/reducir y cerrar siguen siendo botones; tocar el vacío del lienzo reduce la hoja de Historias y cierra la de Propiedades (decisión 138); tocar un nodo en la zona libre ya no reduce (§6.2).
- Barra táctil: visible en modo Historia con un nodo seleccionado (ofrece «Conectar», que el modo no quiere: decisión 131). Se propone ocultar «Conectar» en modo Historia (**M3**); «Seleccionar varios» sigue.
- `#scNotice` en móvil se coloca **encima de la hoja o de la barra de colocación** (`bottom` = alto de lo que haya debajo + 12), nunca sobre «Cancelar».

## 11. Accesibilidad básica

- Todos los controles conservan nombre accesible y los que pierden texto en móvil (no hay ninguno nuevo: «Volver a editar» conserva su rótulo) mantienen `aria-label`.
- `body[data-story]` es solo CSS; el estado semántico sigue en `aria-expanded` de «Historias», ⌃ y ⚙.
- El bloque «Reproduciendo» conserva `aria-live="polite"` en el momento en curso; el autoscroll y el desplazamiento de la vista no mueven el foco.
- Orden de foco de la hoja: fila A → fila B → chips → línea de tiempo. Escape sigue cerrando menús y cancelando colocación (ya).
- Contrastes: los de 018.13/14b (cabecera 15,7:1 clara / 14,3:1 oscura); los chips usan `--active-veil` + `--rule-2` como los segmentados, no cian.
- `prefers-reduced-motion`: sin transición de altura, sin punto «en vivo» y el desplazamiento de la vista hacia un destino es inmediato, no animado.

## 12. Persistencia / estado

| Estado | Dónde | ¿Se guarda? |
|---|---|---|
| `storyState()` (closed/compact/expanded/playing) | derivado en `ui.js` de `uiMode`, `panelOpen`, `storyExpanded`, `scPlaybackOn` | no (no hay variable nueva: es una función) |
| altura real de la hoja ampliada | CSS (`auto` + `max-height`); no hay variable | no |
| paso seleccionado (`scSelectedStep`) y su destino revelado | como hoy en `editor-scenarios.js`; `scRevealTarget` solo mueve la vista | no |
| último desplazamiento manual de la línea de tiempo y de la vista | variables efímeras en `editor-scenarios.js` (para no pelear con el autoscroll ni con el seguimiento del destino) | no |
| hoja de Propiedades abierta, altura | `body.panelOpen` + CSS | no |
| ⚙ contextual | `syncSurfaceButtons`/`refreshPanel` (lee `selN`/`selE`) | no |
| Historia activa, Playback, Steps | como hoy (`scActiveId`, `scStatus`, `scPlayback`, `page.scenarios`) | Steps sí (documento), el resto no |

Nada nuevo en `localStorage`, en `serializeProject` ni en `#d=`. La vista (`viewX/viewY/viewZoom`) ya no se guarda hoy y sigue sin guardarse.

## 13. Compatibilidad

| Pieza | Impacto | Nota |
|---|---|---|
| Documento / formato | **ninguno** | no se escribe ningún campo |
| `model.js`, `config.js`, kernel | **ninguno** | test «idéntico a HEAD» como en 018.13–018.16; fluyo-mcp sin `sync:kernel` |
| Share / Viewer | ninguno | `s/index.html`, `share.css`, `viewer.js` no se tocan |
| Present | ninguno | `present-story.js` lee `scStatus`/`scRun({present:true})`; la hoja no interviene en Present (`body.presenting` la oculta) |
| Historias existentes | ninguno | solo cambia dónde y cuándo se pintan sus filas; Steps, `at`, Trace, Playback intactos |
| Undo/Redo | ninguno | ninguna mutación nueva; mover la vista no es una operación de Undo (ya) |
| MCP | ninguno | sin cambios de contrato ni de kernel |
| SVG / exportación | ninguno | `export.js`, `geometry.js`, `render.js` no se tocan |
| Service Worker | `CACHE` v75 → **v76** al implementar | cambian `index.html`, `css/system.css`, `css/styles.css`, `js/ui.js`, `js/editor-scenarios.js`; sin archivos servidos nuevos |
| Tests existentes | ver §15 | ids conservados; se adaptan umbrales y dos flujos móviles |

**No hace falta tocar dominio**: todo es DOM, CSS y estado de interfaz.

## 14. Archivos que probablemente habría que tocar

| Archivo | Cambio |
|---|---|
| `index.html` | `aside`: fila A (título ▾ · ⋯ · ⌃) y fila B (transporte · «Volver a editar»); `#scNow` dentro de la fila A en móvil (CSS `order`, mismo nodo); sección «Ayuda y gestos» en `#moreMenu` (M2); `#grpAnim` con ancla para `placeChrome` (M1); `#btnStoryExit`, `#btnStoryExpand`, `#scRun`, `#scReset`, `#scScenarioTitle`, `#scStoryAdd`, `#scScenarioMenu`, `#scPaletteToggle`, `#scLibrarySection`, `#scEventNew`, `#scNow*`, `#btnPanel`, `#btnPanelClose` **conservan id** |
| `css/system.css` | `--ctl-h-touch: 44px`; campos a 16 px con `pointer:coarse`; `.chipRail` (carril horizontal) |
| `css/styles.css` | `body[data-story]`: compacta ≈ 128 px fija; ampliada `height:auto; max-height:calc(100dvh − 52 − var(--bb-h) − var(--canvas-useful))` con `--canvas-useful: max(300px, 40dvh)`; reproduciendo ≈ 136 px; `aside{overflow:hidden}` en hoja; qué fila se ve en cada estado; chips en móvil; hoja de Propiedades a `clamp(220px, 40dvh, 360px)`; una fila de muestras con dedo; `#scNotice` sobre la hoja; pestañas con `max-width` y «＋» fijo; `#tbConnect` oculto en modo Historia (M3); `#btnPanel` contextual (M2) |
| `js/ui.js` | `storyState()` + `syncStoryState()` (escribe `body.dataset.story`; se llama desde `setUiMode`, `openSurface`, `closeSurface`, `setStoryExpanded` y `scRenderButtons`); `visibleCanvasRect()` (lienzo menos hoja, barra táctil y rail: la única definición de «zona libre», usada por `revealAboveSheet` y por `scTargetOffscreen`); `revealAboveSheet` con suelo de zoom 0,6 y objetivo «paso»; `sheetTapOutside`: en ampliada solo reduce si el toque cae en el vacío (`hitNode`/`hitEdge` del lienzo); reencaje al entrar en el modo en columna (`fitIfCut()`); `placeChrome` mueve `#grpAnim` a «Más» en móvil (M1); ⚙ contextual (M2); «Añade eventos desde Ampliar» |
| `js/editor-scenarios.js` | `scRenderButtons`: ocultar `#scPaletteToggle` en Playback y «Terminar» en hoja; `scTick`/`scRenderStoryboard`: autoscroll de la fila activa dentro de `.scStoryboardSection` y seguimiento del destino activo solo si sale de la zona libre; `scrollIntoView` de colocar/aplicar/crear evento → `scrollTo` del contenedor; `scTargetOffscreen` usa `visibleCanvasRect()`; `scRenderEventLibrary`: cada chip lleva su botón ⋯ (44 px) con el mismo menú de hoy, sin pulsación larga; `scNotice` con posición dependiente de la hoja; `scSyncCompact` ya no activa `scCompact` en la hoja móvil |
| `sw.js` | `CACHE` v76 (solo al implementar) |
| `docs/index.html` | dos frases: estados de la hoja y «Terminar» en móvil |
| Tests | nuevos `test/fluyo-018-17.test.cjs`, `-browser.cjs`, `-mutations.cjs`; adaptados §15 |

Fuera: `model.js`, `config.js`, `render.js`, `geometry.js`, `export.js`, `interaction.js` (se reutilizan sus `hitNode`/`hitEdge`, sin tocarlos), `viewer.js`, `s/`, `share*.js`, `present-story.js`, fluyo-mcp.

## 15. Tests

- **`test/fluyo-018-17.test.cjs`** (estático / vm):
  - `model.js`, `config.js`, `render.js`, `geometry.js`, `export.js`, `interaction.js`, `viewer.js`, `s/index.html`, `share.css` idénticos a HEAD;
  - ids conservados (lista de §14) y `#scStoryAdd`/`#scReset` presentes en el DOM;
  - `CACHE` v76 y precache completo;
  - `--ctl-h-touch` = 44, regla de 16 px con `pointer:coarse`, hoja de Propiedades ≤ 40dvh, hoja compacta sin «Eventos·N» ni «+», ampliada con `height:auto` y `max-height` que resta `--canvas-useful` (reglas de `styles.css`);
  - vm (arnés de 018.14b): `storyState()` devuelve los cuatro valores en el orden de las puertas; `visibleCanvasRect()` resta hoja, barra táctil y rail; `revealAboveSheet` no baja de 0,6 y centra el paso cuando la página no cabe; `scRenderButtons` oculta `#scPaletteToggle` con `scStatus` ≠ idle; `#grpAnim` viaja a «Más» con `matchMedia` simulado y vuelve.
- **`test/fluyo-018-17-browser.cjs`** (Chrome real; 1440/1280/1101 ratón, 768 dedo, 430/390/375 móvil, 844 × 390 apaisado; interfaz clara y oscura; lienzo oscuro y crema; dos fixtures: el de 4 nodos y uno de ≥ 12 nodos que no cabe a zoom 0,6 en la zona libre):
  - lienzo visible y **lienzo útil** por estado con las medidas de §16 y los umbrales de §20;
  - «Volver a editar» dentro de la hoja y encima (nada lo tapa) en compacta, ampliada, reproduciendo, terminada y **tras colocar un evento**;
  - ampliada: la línea de tiempo enseña ≥ 5 filas; tocar un paso trae su destino a la zona libre (entero, nodo ≥ 36 px de alto); tocar un nodo en la zona libre lo selecciona y la hoja sigue ampliada; tocar el vacío la reduce; un arrastre en la zona libre cambia `viewX/viewY`; con el fixture grande el zoom no baja de 0,6;
  - reproduciendo: bloque con caption y progreso; destino del paso activo dentro de la zona libre en ≥ 3 fotogramas de pasos distintos; en ampliada, fila activa visible; sin `#scPaletteToggle`;
  - un solo desplazable con desbordamiento en la hoja (línea de tiempo) y `aside.scrollTop` = 0 siempre;
  - «Cancelar» ≥ 44 px y `#scNotice` nunca sobre la barra de colocación;
  - barra táctil sin intersección con la selección tras abrir Propiedades;
  - 768 y apaisado: `getBounds()` dentro del lienzo tras entrar en Historias; 1280/1440: la vista no cambia (idéntica a HEAD);
  - barra de páginas: «＋» y dos pestañas a la vista a 375/390/430;
  - objetivos: críticos ≥ 44 (dedo), listas ≥ 40, ratón ≥ 28; campos ≥ 16 px con dedo; **ningún control mide menos que hoy**;
  - ⚙ solo con selección; «Ayuda y gestos» en «Más» (si M2); «Conectar» ausente en modo Historia (si M3); «Animación del lienzo» en «Más» (si M1);
  - escritorio: columna 320, panel 288, cabecera una fila, misma secuencia que HEAD (mover, conectar, Undo) → documento idéntico;
  - 0 errores de consola; SW v76 instala y sirve sin red.
- **`test/fluyo-018-17-mutations.cjs`** (≥ 18): hoja compacta alta otra vez; ampliada con altura fija del 20 %; `max-height` sin restar `--canvas-useful`; zoom por debajo de 0,6 al ampliar; tocar un nodo reduce la hoja; «Volver a editar» dentro del desplazable; `scrollIntoView` sobre la fila (vuelve a mover la hoja); sin autoscroll; destino activo fuera de la zona libre; paleta inerte reproduciendo; «Cancelar» a 29 px; aviso sobre Cancelar; barra táctil sin descontar; sin reencaje a 768; `CACHE` sin subir; 44 → 40; campos a 12 px; «＋» fuera; ⚙ siempre; `model.js` tocado; hoja de Propiedades a 52dvh; chips sin menú.
- **Adaptar, con la misma intención**: `fluyo-018-14b-browser` (umbrales e3/e4 móviles suben; hoja compacta sin «Eventos·N»; `storyExpanded` sigue), `fluyo-018-14b.test`/`-mutations` (pin de `32dvh` y «hoja alta» → nuevos valores), `fluyo-018-12-browser` (la hoja de Historias ya no usa `scCompact`/paleta en móvil: el flujo «elegir evento → tocar destino» pasa por Ampliar → chip), `fluyo-016-browser` (en móvil «+» no está en compacta: crear por el selector ▾ o `scNewScenario`; el contrato «Historia 1 ▾» del título no cambia), `fluyo-018-13-browser` (≥ 40 sigue siendo cierto; se añade ≥ 44 en críticos), `fluyo-011-browser` (ya fallaba antes; no se toca aquí), pins de `CACHE` v75 → v76 (`010-qa`, `013`, `014`, `015`, `018-10`, `018-12`, `018-13`, `018-14a`, `018-14b`, `018-15`, `018-16`).
- Regresión completa: `node --test test/*.test.cjs`, batería de Chrome, mutaciones de 018.12–018.16, `node --check`, `git diff --check`; fluyo-mcp `npm test` + `check:kernel` (sin cambios esperados).

## 16. QA Chrome: medidas de «lienzo útil» por estado

Mismo arnés que §3 (se versiona como `fluyo-018-17-browser.cjs`), ejecutado antes y después para obtener tablas comparables. Además del «% de pantalla que es lienzo», que mide cantidad, se añaden medidas que miden **utilidad**, porque un 20 % de lienzo a zoom 0,44 cumple el porcentaje y no sirve:

| Medida | Cómo se calcula | Para qué estado |
|---|---|---|
| `zonaLibre` | rectángulo del lienzo menos hoja, barra táctil y rail (`visibleCanvasRect()`), en px y % de pantalla | todos |
| `zoom` | `viewZoom` tras el reencaje | compacta, ampliada, reproduciendo |
| `destinoVisible` | caja en pantalla del destino del paso seleccionado (ampliada) o activo (reproduciendo) ⊂ `zonaLibre`, con margen ≥ 8 px | ampliada, reproduciendo |
| `destinoLegible` | alto del destino en pantalla ≥ 36 px (nodo) o longitud ≥ 48 px (conexión); etiqueta ≥ 8 px (`fs × zoom`) | ampliada, reproduciendo |
| `nodosEnteros` | nodos completamente dentro de `zonaLibre` / total | compacta, ampliada, reproduciendo |
| `desplazable` | un arrastre de 60 px en `zonaLibre` cambia `viewX` o `viewY`; un pellizco cambia `viewZoom` | ampliada |
| `tocable` | un toque sobre un nodo en `zonaLibre` lo selecciona (`selN`) sin cambiar `storyState()` | ampliada |
| `filasLineaTiempo` | filas de `.scStoryRow` completamente dentro de la hoja | ampliada |
| `filaActivaVisible` | `.scStatus_active` dentro de `.scStoryboardSection` | ampliada + reproduciendo |
| `seleccionVisible` | caja de la selección ⊂ `zonaLibre` (sin barra táctil encima) | Propiedades |
| `alturaHoja` | caja del `aside`; en ampliada, también con 1, 4 y 9 pasos (altura por contenido) | todos |
| `scrollHoja` | `aside.scrollTop` y nº de desplazables con desbordamiento | todos |

Fixtures: el de 4 nodos (cabe a zoom ≥ 0,6 en la zona libre) y uno de ≥ 12 nodos (no cabe: debe centrarse el destino sin bajar de 0,6). Capturas por viewport × estado × interfaz × lienzo en el scratchpad y una hoja antes | después de 390 (compacta, ampliada con 1 y 9 pasos, reproduciendo, Propiedades) para la revisión. Además, a mano: iOS Safari y Android Chrome en un dispositivo físico para `dvh`, el zoom de campos y el teclado virtual (no se puede emular aquí).

## 17. Riesgos

- **`editor-scenarios.js` (2640 líneas)**: el autoscroll, el seguimiento del destino y el cambio de `scrollIntoView` tocan el render que corre a cada fotograma; medir que `scRenderStoryboard` no se dispare más (su firma ya evita repintar) y que el seguimiento del destino solo mueva la vista cuando el destino sale de la zona libre.
- **Altura por contenido**: al añadir pasos la hoja crece hasta el tope; crece con transición (y sin ella con `reduced-motion`) y **nunca se encoge sola** mientras la hoja está abierta (solo al reducir/cerrar), para que no baile bajo el dedo.
- **Suelo de zoom 0,6**: con diagramas grandes el usuario ve una parte y desplaza; es lo que se pide (reconocible y útil) frente a verlo todo ilegible. El valor 0,6 (etiquetas ≈ 8 px) se contrasta en el dispositivo físico.
- **Chips de evento en móvil**: cambian la forma de llegar al menú ⋯ de un evento; si el chip crece (⋯ dentro), la fila de chips llega a 44 px y el nombre se recorta: comprobar con nombres largos.
- **Retirar «Terminar» en móvil** altera un texto que afirman los tests de 016 solo en escritorio; en móvil el estado «terminada» se cierra por ▾, ⌃ o «Volver a editar».
- **Tocar un nodo en ampliada ya no reduce**: quien reducía tocando un nodo ahora toca el vacío (hay vacío siempre: la zona libre mide ≥ 300 px de alto).
- **Hoja de Propiedades más baja**: con «Forma y color» abierto hace falta desplazar más (2,0 → ~2,4 pantallas a 375); lo compensa que la selección queda a la vista.
- **`#grpAnim` en «Más»** (M1): los tests de 018.12 que buscan «Animación» como grupo del panel se adaptan.
- **Apaisado de teléfono** sigue con la columna de 320 px y 296 px de lienzo: fuera de este slice (§18).
- **`dvh` y teclado virtual** en iOS: no verificable aquí.

## 18. Fuera de alcance (D8 aprobada: queda para 018.18 o después)

- Pausar / reanudar la reproducción (no existe en el kernel de Playback ni en Present/Viewer; sería una capacidad nueva de `story-playback.js` y de las tres superficies).
- Present táctil (toque que avanza y corta la Historia; P2-5), Viewer móvil, Share.
- Diálogo de evento con dedo (✕ 29 px, chips 27, segmentados 24): solo hereda los 16 px de los campos.
- Navegación avanzada de páginas (selector); apaisado de teléfono como layout propio; panel plegable en escritorio; barra contextual flotante y control de color compacto.
- Nueva gramática de conexiones, `model.js`, iconos nuevos, IA, MCP, SVG, `prefers-color-scheme`.
- `fluyo-011-browser` (3 fallos previos) y `share-browser` intermitente.

## 19. Decisiones menores M1–M3 (explícitas; afectan a interacción, las decide el responsable)

| | Qué es | Comportamiento que implica | Qué NO cambia | Recomendación |
|---|---|---|---|---|
| **M1** | El grupo «Animación del lienzo» (Pausa/Play de la animación ambiental, velocidad, puntos, aparición escalonada) sale de la hoja de Propiedades **en móvil** y vive en «Más» › Lienzo | En un teléfono, para pausar la animación ambiental o cambiar su velocidad se abre «Más» (un toque) en vez de ⚙ + desplazar hasta el final. La tecla Espacio sigue alternando Pausa/Play. La hoja de Propiedades queda solo con lo de la selección | Escritorio y tableta: el grupo sigue en el panel. El documento (`settings.speed/dots/build/stagger`) y su semántica no cambian | Sí: es un ajuste del documento, no de la selección, y ya viven en «Más» › Lienzo los demás (tema, fondo, tipografía, cuadrícula) en móvil (decisión 135) |
| **M2** | ⚙ (Propiedades) pasa a ser **contextual** en móvil: solo se muestra en modo Editar con algo seleccionado. La ayuda del estado vacío («Nada seleccionado» + atajos y gestos) pasa a «Más» › «Ayuda y gestos» | Sin selección, la cabecera móvil tiene cuatro acciones (Deshacer, Rehacer, Compartir, Más) y el hueco de ⚙ queda vacío; al seleccionar, aparece ⚙ (y la barra táctil, como hoy). La ayuda se lee desde «Más». El empty state de la hoja (`#noSel`) no se muestra nunca en móvil porque la hoja no se abre sin selección | Escritorio y tableta: el panel sigue mostrando la ayuda sin selección. Los ids `#btnPanel`, `#noSel`, `#grpHelp` se conservan | Sí: ⚙ sin selección abre una hoja que no edita nada y resta un primer nivel (D5: solo acciones primarias) |
| **M3** | «Conectar» de la barra táctil se oculta en modo Historia | Con un nodo seleccionado en modo Historia, la barra táctil solo ofrece «Seleccionar varios» (mover grupos sí tiene sentido mientras se narra). En modo Editar, igual que hoy | La tecla C ya no arma «Conectar» en modo Historia (decisión 131): M3 alinea el botón con la tecla. `interaction.js` no cambia (es CSS sobre `body.storyMode #tbConnect`) | Sí: coherencia con la decisión 131 («se narra, no se construye») |

Si alguna se rechaza, el resto del slice no depende de ella: M1 y M2 solo tocan `placeChrome`/`syncSurfaceButtons` y dos reglas CSS; M3 es una regla CSS.

## 20. Criterios de aceptación

Los de cantidad (% de pantalla) se mantienen donde el lienzo manda; en ampliada y reproduciendo se exigen además los de utilidad (§16), que son los que demuestran que el lienzo «sigue siendo parte de la experiencia».

| Criterio | 1440 | 1280 | 768 | 430 | 390 | 375 |
|---|---|---|---|---|---|---|
| Cerrada: lienzo ≥ | 66 % (sin cambio) | 60 % | 56 % | 82 % | 80 % | 80 % |
| Compacta: lienzo ≥ · hoja ≤ | 66 % · col. 320 | 60 % · col. 320 | 52 % + **sin corte** | 72 % · 136 px | 70 % · 136 px | 68 % · 136 px |
| Compacta: página encajada en la zona libre a zoom ≥ 0,6 (fixture de 4 nodos) | — | — | — | ✔ | ✔ | ✔ |
| **Ampliada: zona libre ≥ `max(300px, 40dvh)`** (373 / 338 / 325 px) | — | — | — | ✔ | ✔ | ✔ |
| Ampliada: destino del paso seleccionado entero, legible (nodo ≥ 36 px, etiqueta ≥ 8 px) y zoom ≥ 0,6, con los dos fixtures | — | — | — | ✔ | ✔ | ✔ |
| Ampliada: zona libre desplazable (pan/pellizco) y tocable (tocar un nodo selecciona sin reducir; tocar el vacío reduce) | — | — | — | ✔ | ✔ | ✔ |
| Ampliada: línea de tiempo ≥ 5 filas enteras; altura de la hoja por contenido (1 paso < 4 pasos ≤ tope) | — | — | — | ✔ | ✔ | ✔ |
| Reproduciendo: lienzo ≥ · hoja ≤ | 66 % | 60 % | 51 % | 74 % · 140 px | 72 % · 140 px | 70 % · 140 px |
| Reproduciendo: bloque «Reproduciendo» visible y destino del paso activo dentro de la zona libre (≥ 3 pasos distintos) | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| Ampliada + reproduciendo: fila activa visible en la línea de tiempo | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| Propiedades (plegado): lienzo ≥ y selección entera en la zona libre, sin barra táctil encima | 66 % | 60 % | 53 % | 48 % | 45 % | 45 % |
| «Volver a editar» visible y no tapado en 4 estados + tras colocar | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| Desplazables anidados en la hoja/columna · `aside.scrollTop` = 0 | ≤ 2 (sin cambio) | ≤ 2 | ≤ 2 | **1** · 0 | **1** · 0 | **1** · 0 |
| Objetivos críticos ≥ 44 (dedo) · listas ≥ 40 · ratón ≥ 28 · ninguno más pequeño que hoy | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| «Cancelar» de colocación ≥ 44 (dedo) y nunca tapado | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| «＋» y dos pestañas visibles en la barra de páginas | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| Cabecera una fila ≤ 56 px; 0 overflow | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| Escritorio idéntico a HEAD en documento y vista tras la misma secuencia | ✔ | ✔ | — | — | — | — |
| `model.js`/kernel/Viewer/Share/Present sin cambios; `CACHE` v76; 0 errores | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |

---

## 20 bis. Decisiones (D1–D8) con su estado

**D1 — Historias como modo propio: APROBADA.** Ya lo es (decisión 131); 018.17 lo completa en móvil con `storyState()` derivado (sin variable nueva) → `body[data-story]`, cuatro estados con el contenido de §6.2, entrada por «Historias» (barra inferior) y por el conmutador (escritorio), salida siempre «Volver a editar».

**D2 — Presentación móvil: APROBADA CON CORRECCIÓN.** Jerarquía: cerrada = lienzo protagonista; compacta = lienzo protagonista + hoja de control de dos filas (≈ 128 px); **ampliada = la Historia manda, pero el lienzo sigue siendo reconocible y útil**: la hoja mide lo que mide la Historia (`height:auto`) hasta un tope que se deriva de lo que el lienzo necesita (`--canvas-useful: max(300px, 40dvh)`: ver el destino del paso seleccionado entero y legible, con margen para el dedo, y poder desplazar), no de un porcentaje elegido; tocar un paso trae su destino a la zona libre; tocar un nodo lo selecciona sin reducir; tocar el vacío reduce; colocar un evento sigue apartando la hoja; eventos como carril de chips; la línea de tiempo es el único desplazable y enseña ≥ 5 filas. Descartados: modal o pantalla propia (tapan el lienzo), franja fija del 20–24 % (lienzo de adorno), hoja arrastrable, partir el lienzo en vertical.

**D3 — Reproduciendo: APROBADA.** Parte fija y mínima (≈ 136 px de hoja, lienzo ≥ 72 %); el evento activo se ve en el lienzo (destino dentro de la zona libre, reencaje al reproducir y seguimiento solo si sale) y en la hoja (bloque «Reproduciendo»); «Ampliar» disponible con autoscroll de la fila activa. Terminada: `[↻ Repetir] [← Volver a editar]` en móvil; «Terminar» solo en escritorio.

**D4 — Panel: APROBADA.** Bottom sheet adaptativo (40dvh por defecto, crece con el contenido abierto), lo frecuente arriba, «Animación del lienzo» fuera (M1), barra táctil descontada del área libre, campos a 16 px. Escritorio y tableta: columna como hoy.

**D5 — Cabecera móvil: APROBADA.** Primer nivel: logo · Deshacer · Rehacer · Compartir · Más; ⚙ contextual (M2). Presentar e Historias en la barra inferior. Escritorio sin cambios.

**D6 — Touch: APROBADA.** 44 px (`--ctl-h-touch`) para salir, cerrar, cancelar, reproducir/detener, ampliar, modo, cabecera, «＋» y chips; 40 px con toque a todo el ancho para filas de lista; campos a 16 px; nada más pequeño que hoy.

**D7 — Desktop: APROBADA.** No se trasladan hojas, asa, chips, 44 px, ocultaciones, altura por contenido ni suelo de zoom. Se comparten solo correcciones funcionales: autoscroll de la fila activa, paleta oculta al reproducir y reencaje al entrar en Historias cuando el diagrama se corta (768, apaisado).

**D8 — Fuera de alcance: APROBADA.** Pausa/reanudar, Present táctil, Viewer móvil, diálogo de evento táctil, navegación avanzada de páginas, apaisado avanzado, panel plegable en escritorio y barra contextual quedan para 018.18 (§18).

---

## Implementación (9 de octubre de 2026)

Implementado exactamente según el plan y las decisiones cerradas, en el orden pedido (superficie/modo → estados → evento activo → lienzo → panel → touch → cabecera → M1–M3 → reencaje → tests → Chrome → mutaciones → regresión). Sin tocar el dominio.

### Comportamiento implementado

1. **Historias en móvil es una superficie con cuatro estados** (`storyState()` derivado → `body[data-story]`, decisión 146):
   - **compacta** (125 px): fila A = nombre de la Historia ▾ (elige) · ⋯ · Ampliar; fila B = ▶ Reproducir · «← Volver a editar». Sin rótulo del modo, sin «+» (vive en el selector ▾), sin paleta ni línea de tiempo. Si la Historia no tiene pasos, la fila B dice «Añade eventos desde Ampliar» (`#scRunHint`) en lugar del botón apagado.
   - **ampliada** (`height:auto` hasta `100dvh − 52 − barra − max(300px, 40dvh)`): fila A/B + **fichas de eventos** en un carril horizontal (con «+ Crear evento» delante y su ⋯ dentro) + **línea de tiempo**, el único desplazable (la hoja lleva `overflow:hidden`). Los `scrollIntoView` de colocar/aplicar/crear evento pasan a `scScrollIntoView` (solo el contenedor más cercano): «Volver a editar» ya no se va de la hoja.
   - **reproduciendo** (135 px): fila A = bloque «Reproduciendo» (momento en curso y progreso) · Ampliar; fila B = ■ Detener · «← Volver a editar». Reproducir recoge la ampliada; Ampliar sigue disponible y enseña la línea de tiempo con la fila activa a la vista. Terminada: ↻ Repetir · «Volver a editar»; **sin «Terminar» en la hoja** (lo hacen el selector ▾ y Ampliar, que termina y abre el taller). Escritorio y tableta conservan «Terminar».
   - **cerrada**: nada sobre el lienzo.
2. **El lienzo contextualiza** (decisión 148): `visibleCanvasRect()` es la única definición de zona libre (lienzo − hoja − barra táctil − barra de colocación). `revealAboveSheet` encaja la página solo si cabe a zoom ≥ 0,6; si no, no se encoge: centra el destino del paso seleccionado (o del primero). Tocar un paso trae su destino a la zona libre; tocar un nodo o una conexión en la zona libre lo selecciona y la hoja ampliada se queda (solo el vacío reduce; colocando, nada). Reproduciendo, `scFollowActive` sigue el paso en curso (fila activa o, en momentos instantáneos, el último llegado) solo al cambiar de paso: su fila en la línea de tiempo (salvo desplazamiento manual con rueda o dedo en los 2 s previos) y su destino en la zona libre solo si ha salido. En escritorio y tableta: autoscroll de la fila activa y paleta oculta reproduciendo (correcciones compartidas, D7).
3. **Panel móvil** (decisión 149): hoja de `clamp(220px, 40dvh, 360px)`; una fila de muestras + «Más colores» con el dedo; campos a 16 px con puntero grueso (también renombrar y el diálogo de evento, por herencia); la selección revelada deja 12 px de aire y la barra táctil se descuenta. Escritorio/tableta sin cambios.
4. **Touch** (decisión 150): `--ctl-h-touch` 44 (lo que cambia de estado o lo cierra) y `--row-h-touch` 40 (filas); «Cancelar»/«Aplicar» de colocación a tamaño de control; «Mostrar en el sistema» a 40; «＋» de páginas a 44 y `position:sticky`; pestañas inactivas con índice (40 px), la activa con nombre o, con menos de 200 px de carril, «01 ▾». Nada mide menos que antes.
5. **Cabecera móvil** (D5, M2): logo · Deshacer · Rehacer · Compartir · ⚙ (solo con selección en modo Editar) · Más. Sin selección la hoja de Propiedades se cierra sola. La ayuda de atajos y gestos vive en «Más» › «Ayuda y gestos»; «Animación del lienzo» en «Más» (M1). «Conectar» de la barra táctil no se ofrece en modo Historia (M3). Los mismos nodos viajan con `placeChrome` y vuelven al panel en escritorio.
6. **Reencaje en columna** (decisión 151): al entrar en Historias en tableta o apaisado, si un diagrama que cabía queda cortado se reencaja; una vista ya acercada no se toca; en 1280/1440 no se dispara.
7. **Avisos**: en móvil `#scNotice` se coloca encima de la hoja o de la barra de colocación.

### Archivos modificados

- **Producto (servidos)**: `index.html` (`#scRunHint`, `#animSection`, `#helpSection`, `#grpAnimHome`, `#grpHelpHome`, comentario de los estados), `css/system.css` (`--ctl-h-touch` 44, `--row-h-touch` 40, ítems de menú como filas, campos a 16 px al final), `css/styles.css` (estados de la hoja, rejilla de dos filas, fichas, único desplazable, Propiedades 40dvh, muestras, páginas, Cancelar, «Mostrar en el sistema», «＋» 44), `js/ui.js` (`storyState`/`syncStoryState`, `visibleCanvasRect`, `revealAboveSheet` con suelo y objetivo «paso», `sheetTapOutside` solo vacío, `diagramCut` + reencaje, `placeChrome` M1/M2, ⚙ contextual, M3, `mqSheet`/`uiMode`/`isSheetLayout` al principio), `js/editor-scenarios.js` (`scFollowActive`, `scScrollIntoView`, `scVisibleRect`/`scTargetOffscreen`/`scRevealTarget`/`scStoryFocusPoint`, `scRenderButtons`, `scRun` recoge la ampliada, `scNotice`, `scSyncCompact`), `docs/index.html` (un párrafo), `sw.js` (`CACHE` v76).
- **Tests nuevos**: `test/fluyo-018-17.test.cjs` (10), `test/fluyo-018-17-browser.cjs`, `test/fluyo-018-17-mutations.cjs` (18 estáticas + 16 en Chrome).
- **Tests adaptados, con la misma intención**: `fluyo-018-14b.test.cjs` (hoja por contenido, toque en el vacío), `fluyo-018-14b-browser.cjs` (⚙ contextual: crítico solo con selección; terminada en móvil: Ampliar en vez de «Terminar»; `fitView()` antes de tocar otro nodo y antes de conectar con el dedo, porque la vista ya no baja de 0,6 para enseñarlo todo), `fluyo-018-12-browser.cjs` (elegir un evento desde la ampliada; `usefulAbove` con el suelo de zoom; reproduciendo ≤ 28 % sin exigir «más baja que la compacta»; Pausa en «Más» en móvil, M1), `fluyo-018-13-browser.cjs` (cabecera móvil con 4 controles sin selección, M2), `fluyo-016-browser.cjs` (en la hoja compacta no hay «+»), `fluyo-018-12-mutations.cjs` B7, `fluyo-018-14b-mutations.cjs` B9 y U5 (patrones de las alturas nuevas y de `scRun`); pines de `CACHE` v75 → v76 en 21 archivos.
- **Deuda previa corregida (HEAD movido)**: desde que 018.11–018.16 se commitearon en `3fa91e8`, nueve comprobaciones suponían que HEAD seguía siendo `604b344`: seis unitarias fallaban en el árbol limpio (`fluyo-018-12.test` ids de HEAD; `018-13`, `018-14a` ×2, `018-14b`, `018-15` «idéntico a HEAD salvo…») y tres de Chrome (`fluyo-018-4-browser` «HEAD: undo ×2 solo deshacía uno», las «diferencias intencionales frente a HEAD» de `fluyo-018-12-browser` y la copia de HEAD de `fluyo-017-3-browser`, que no incluía `assets/` y caía con `ERR_HTTP_HEADERS_SENT` al pedir las fuentes de 018.13). Ahora deshacen el mismo cambio en los dos lados, detectan si HEAD ya incluye 018.12/018.15, o copian `assets/`.
- **Documentación**: `.ai/DECISIONS.md` (146–151), `.ai/ARCHITECTURE.md` (§ 018.17), `CONTRIBUTING.md` (una línea del mapa), esta tarea.
- **Sin cambios**: `js/model.js`, `js/config.js`, el resto del kernel, `js/render.js`, `js/geometry.js`, `js/export.js`, `js/interaction.js`, `js/viewer.js`, `js/present-story.js`, `js/share-url.js`, `js/editor-share.js`, `s/`, `css/share.css`, `css/identity.css` (test de alcance contra HEAD). fluyo-mcp: `check:kernel` verde, sin sincronizar nada.

### Desviaciones respecto al plan

- **Tres afinados que salieron de la regresión** (no cambian el diseño): la zona libre toma la posición de la hoja de su altura (`offsetHeight`), no de su caja, porque la hoja entra con una transición de `transform` y durante ella la caja miente; la selección revelada solo se desplaza en horizontal si se sale de la zona (moverla de más sacaba de pantalla el nodo de al lado); y el cierre de la hoja sin selección (M2) se decide al reposo del puntero (`scheduleSheetIdleCheck`, 60 ms y sin puntero apoyado), porque tocar otro elemento vacía y vuelve a llenar la selección dentro del mismo gesto.

- **Línea de tiempo en la hoja ampliada**: el plan estimaba «≥ 5 filas». Las filas reales llevan dos líneas (nombre del evento + frase) y entre momentos van las esperas: con 181 px (390) / 162 px (375) / 234 px (430) se ven uno o dos pasos enteros y parte del siguiente (antes: 142 px, uno y medio, con un 20 % de lienzo). Para ganar sitio se quitó el rótulo «HISTORIA» dentro de la hoja y se apretaron los huecos. El criterio pasa a «≥ 180 px y ≥ 1 paso entero» (test) y se documenta aquí.
- **Lienzo con Propiedades**: el plan ponía ≥ 48/45/45 %; la medida de pantalla completa descuenta también el rail (49 px) y la barra táctil (54 px) que aparece con la selección, que el plan no contó. Medido: 41 % (430) · 37 % (390) · 35 % (375), frente a 28 / 25 / 24 % antes; la hoja mide 40dvh como se pidió y la selección queda entera en la zona libre. Umbrales del test: 39 / 36 / 34 %.
- **Reproduciendo a 390**: 71 % medido (el plan decía 72); umbrales 72 / 70 / 68 % (430/390/375). Compacta: 74 / 72 / 71 % medidos (plan 72/70/68).
- **Barra de páginas a ≤ 200 px de carril**: en vez de un nombre recortado a dos letras, la activa queda como «01 ▾» (su nombre está en el menú de la página, a un toque) y las demás como índice; «＋» siempre a la vista. A 430 (202 px) y en tableta/escritorio el nombre se ve.
- **Apaisado 844 × 390** (fuera de alcance, D8): cae en el layout de columna; se beneficia del reencaje y del autoscroll, pero su línea de tiempo (~80 px) no cabe una fila entera: el test lo tolera y queda para 018.18.
- Dos comprobaciones fallaron en la primera pasada completa y se corrigieron antes de cerrar: «＋» de páginas a 40 px en tableta (ahora `var(--ctl-h)` → 44 con dedo) y el caso apaisado anterior.

### Medidas de Chrome (antes → después; interfaz clara, lienzo oscuro, fixture de 4 nodos)

| | Cerrada | Historias compacta | Historias ampliada | Reproduciendo | Propiedades |
|---|---|---|---|---|---|
| 430 × 932 | 84 → 84 % | 58 → **74 %** (hoja 280 → 125 px) | 20 → **40 %** (zona libre 186 → 373 px; zoom 0,49 → 0,6; línea de tiempo 213 → 234 px) | 64 → **74 %** (hoja 220 → 135) | 28 → **41 %** (hoja 485 → 360) |
| 390 × 844 | 82 → 82 % | 55 → **72 %** (270 → 125) | 20 → **40 %** (169 → 338 px; 0,44 → 0,6; 142 → 181 px) | 61 → **71 %** (219 → 135) | 25 → **37 %** (439 → 338) |
| 375 × 812 | 81 → 81 % | 54 → **71 %** (260 → 125) | 20 → **40 %** (162 → 325 px; 0,43 → 0,6; 117 → 162 px) | 60 → **70 %** (211 → 135) | 24 → **35 %** (422 → 325) |
| 768 × 1024 | 57 % | 52 % y **sin corte** (antes cortado) | — | 51 %, fila activa a la vista | 54 % |
| 1280 × 720 | 61 % | 62 % (columna 320) | — | 61 %, fila activa a la vista, sin paleta | 61 % |
| 1440 × 900 | 67 % | 68 % (columna 320) | — | 67 % | 67 % |

Lienzo útil (nuevo): en los tres móviles, el destino del paso seleccionado entero y legible (nodo ≥ 42 px, etiqueta ≥ 8,4 px) a zoom 0,6 al tocarlo; la zona libre se desplaza con un dedo y tocar un nodo selecciona sin reducir; el destino del paso activo está en la zona libre en cada paso (fixture de 4 y de 12 nodos); un solo desplazable (`scStoryboardSection`) y `aside.scrollTop` = 0 siempre, también tras colocar; «Volver a editar» visible y encima en los cuatro estados y tras colocar; «Cancelar» de colocación 88 × 44 y sin aviso encima; campos a 16 px con dedo; 0 objetivos por debajo de 40 (y de 44 en los críticos); cabecera de una fila (50–52 px) en los ocho viewports; 0 errores de consola.

### Tests

- **Unitarios**: `node --test test/*.test.cjs` → **1088/1088** (1078 + 10 de `fluyo-018-17.test.cjs`; en el árbol limpio fallaban 6 por la deuda de HEAD descrita arriba). `node --check js/*.js sw.js` OK. `git diff --check` limpio.
- **`test/fluyo-018-17-browser.cjs`** (Chrome 155 real): 1440/1280/1101 ratón, 768 tableta, 430/390/375 móvil, 844 × 390 apaisado × interfaz clara (lienzo oscuro) y oscura (crema) × fixtures de 4 y 12 nodos + Service Worker v76 sin red. Primera pasada completa **457 ✔ · 2 ✘** (las dos corregidas: «＋» a 44 en tableta y la fila activa en apaisado); reejecución de 768 y 844 × 390: **38 ✔ · 0 ✘** cada una; la pasada final completa está en § READY FOR COMMIT.
- **Mutaciones** `test/fluyo-018-17-mutations.cjs`: estáticas **18/18 detectadas** (CACHE, 44 → 40, 16 px, 52dvh, altura fija, hoja que desplaza, variable espejo, barra táctil, sin suelo de zoom, tocar un nodo reduce, sin reencaje, `scrollIntoView` sobre la fila, sin seguimiento, paleta inerte, M1, M2, M3, `model.js`); las 16 de Chrome en § READY FOR COMMIT.
- **fluyo-mcp**: el kernel no cambia (`npm run check:kernel` → idéntico); no hace falta `sync:kernel` ni la suite MCP.

### Revisión manual del responsable (dentro de 018.17)

1. **El fondo propio del lienzo anulaba los fondos predefinidos.** Reproducido en Chrome: con `doc.customBg` puesto (p. ej. rojo), cambiar el tema a crema dejaba el píxel del lienzo en rojo, porque `render.js` pinta `doc.customBg || THEMES[theme].bg`. Causa: el manejador del tema solo escribía `theme`. Corrección (decisión 152): elegir un tema escribe `{theme, customBg:""}` por `setThemeIn` y el selector de color propio enseña el fondo del tema cuando no hay color propio (`syncProjectControls`, `js/state.js`); el ✕ sigue quitando el color propio sin cambiar de tema. Regresión: `fluyo-018-17.test.cjs` (manejador y `syncProjectControls`), `fluyo-018-17-browser.cjs` (en cada viewport: color propio rojo → tema crema → píxel crema, `customBg` vacío, selector en `#f4eee1`) y mutaciones U20/B18. `fluyo-018-7a-mutations` T11 actualizada al manejador nuevo.
2. **Varios botones del rail marcados como activos.** Reproducido en Chrome (ratón y dedo): al elegir «Caja» quedaban encendidos Caja, Flecha e Imagen; al elegir «BD», BD, Flecha e Imagen. Causa raíz, no visual: `syncRail` llamaba a `classList.toggle("toggled", expr)` y `expr` daba `undefined` en los botones sin `data-shape` cuando su primer término era falso (`b.dataset.shape && …`), y `toggle` sin segundo argumento booleano INVIERTE la clase; como `syncRail` se llama en cada cambio, Flecha e Imagen se encendían y apagaban a ratos. Corrección (decisión 153): `!!(…)`, el estado es una función pura de `mode`/`pendingShape`/`pendingIcon`/`pendingAnim`. Regresión: test estático, `fluyo-018-17-browser.cjs` (Caja → solo Caja; BD → solo BD; Mover → solo Mover, en los ocho viewports) y mutaciones U19/B17.
3. **Deuda de producto, solo rastreada: el «selector de dirección del flujo» de las conexiones.** No ha desaparecido: es `#flowSel` («Flujo de puntos»: Normal →, Inverso ←, Alterno ⇄), que escribe `edge.flowDir` (`normal | reverse | alternate`, `model.js`, formato v5 y `update_connection` del MCP) y solo invierte el sentido en que se mueven los **puntos animados** por la conexión (`render.js` 855–856; la ruta, las puntas y las Historias no lo leen: `geometry.js` 12). Vive en la fila `#rowFlow` del grupo «Flujo» del panel de la conexión, que desde 018.14b (B6, decisión 136) está **plegado por defecto** en escritorio y en la hoja móvil (medido: con una conexión seleccionada, grupos Texto*, Recorrido*, Trazo* abiertos y Flujo plegado, fila de 30 px dentro). Implicaciones: la capacidad sigue en el documento y en el MCP; lo que se perdió es su descubribilidad (dos niveles: seleccionar la conexión y abrir «Flujo»), y el nombre «Flujo de puntos» no dice «dirección». **Propuesta para 018.18**: mover la fila al grupo «Trazo» (abierto, donde están las puntas de flecha, con las que se confunde la dirección) o hacerla visible como segmentado de tres opciones en la cabecera del panel de la conexión; sin nueva semántica (`flowDir` y sus tres valores siguen tal cual).

### Regresión de Chrome (Chrome 155 real, batería completa)

| Suite | Resultado |
|---|---|
| `fluyo-018-17-browser` (nuevo) | **523 ✔ · 0 ✘** (pasada completa final con las comprobaciones de la revisión manual; 8 viewports × 2 interfaces × 2 fixtures + SW v76; antes de la revisión, 459) |
| `fluyo-013`, `013-qa`, `014`, `015`, `015-qa`, `016`, `018-3`, `018-5`, `018-7a` (repetida verde tras cambiar el manejador del tema), `018-7c`, `018-7d`, `018-8`, `018-9`, `018-10`, `018-14a`, `018-15`, `018-16`, `qa-share-hash`, `share-realistic-size` | verdes sin cambios |
| `fluyo-017-3-browser` | verde tras incluir `assets/` en su copia de HEAD (deuda de HEAD movido) |
| `fluyo-018-4-browser` | **76 ✔ · 0 ✘** tras adaptar la comprobación «HEAD: undo ×2» (deuda de HEAD movido) |
| `fluyo-018-12-browser` | **269 ✔ · 0 ✘** tras adaptar (ampliada para elegir eventos, suelo de zoom, Pausa en «Más», HEAD movido) |
| `fluyo-018-13-browser` | **253 ✔ · 0 ✘** tras adaptar (⚙ contextual) |
| `fluyo-018-14b-browser` | **530 ✔ · 0 ✘** tras adaptar (⚙ contextual, «Terminar» en móvil, vista encajada antes de tocar otro nodo y de conectar); repetida verde tras la revisión manual |
| `fluyo-011-browser` | los mismos 3 fallos previos (subtests 4, 6 y SW v45 → v61), pendientes desde 018.12 |
| `scenario-qa`, `share-browser`, `share-post-qa` | «NOT RUN — environment», como siempre (gate de privacidad sin script de Umami) |

Mutaciones de regresión (estáticas): 018.12 **8/8**, 018.13 **6/6**, 018.14b **10/10** (U5 con el patrón de `scRun` actualizado), 018.15 **12/12**, 018.16 **9/9**. `test/fluyo-018-17-mutations.cjs`: estáticas 18/18; en Chrome, la primera pasada completa dejó viva B9 (la barra táctil sobre la selección no era observable con el fixture) y se endureció la comprobación con el contrato de la zona libre; resultado final en § READY FOR COMMIT.

---

# FLUYO-018.17 — READY FOR COMMIT

- **Archivos modificados** (sin commit): servidos `index.html`, `css/system.css`, `css/styles.css`, `js/ui.js`, `js/state.js` (una línea, revisión manual), `js/editor-scenarios.js`, `docs/index.html`, `sw.js`; documentación `.ai/DECISIONS.md` (146–153), `.ai/ARCHITECTURE.md` (§ 018.17), `CONTRIBUTING.md`, esta tarea; tests nuevos `test/fluyo-018-17.test.cjs`, `test/fluyo-018-17-browser.cjs`, `test/fluyo-018-17-mutations.cjs`; tests adaptados `fluyo-016-browser`, `fluyo-017-3-browser`, `fluyo-018-4-browser`, `fluyo-018-7a-mutations` (T11, manejador del tema), `fluyo-018-12-browser`, `fluyo-018-12-mutations`, `fluyo-018-12.test`, `fluyo-018-13-browser`, `fluyo-018-13.test`, `fluyo-018-14a.test`, `fluyo-018-14b-browser`, `fluyo-018-14b-mutations`, `fluyo-018-14b.test`, `fluyo-018-15.test` y los pines de `CACHE` (`010-qa`, `013`, `014`, `015`, `018-10` ×3, `018-13-mutations`, `018-14a-mutations`, `018-15-mutations`, `018-16-mutations`, `018-16.test`).
- **Comportamiento implementado**: § Implementación (cuatro estados de la hoja de Historias con su contenido propio; lienzo útil con zona libre única, suelo de zoom 0,6 y destino del paso a la vista; seguimiento del paso activo; panel móvil de 40dvh; 44/40 px; cabecera móvil con ⚙ contextual; M1–M3; reencaje en columna; avisos sin tapar «Cancelar»).
- **Decisiones**: 146–153 en `.ai/DECISIONS.md` (152 y 153 salen de la revisión manual). D1–D8 y M1–M3 cerradas por el responsable; ninguna decisión de producto nueva.
- **Desviaciones**: § Desviaciones (línea de tiempo ≥ 180 px y ≥ 1 paso entero; Propiedades 41/37/35 % por rail y barra táctil; páginas «01 ▾» con menos de 200 px de carril; apaisado fuera de alcance; tres afinados de la regresión).
- **Tests**: `node --test test/*.test.cjs` **1089/1089**; `node --check js/*.js sw.js` OK; `git diff --check` limpio.
- **Mutaciones**: 018.17 estáticas 20/20 (U19/U20 de la revisión manual); Chrome **16/16** (pasada completa **34/34**; en la primera pasada completa sobrevivía B9 hasta endurecer la comprobación de la zona libre) más **B17 y B18** de la revisión manual, detectadas (4 y 2 comprobaciones fallan); regresión 018.12 8/8 · 018.13 6/6 · 018.14b 10/10 · 018.15 12/12 · 018.16 9/9.
- **Chrome**: `fluyo-018-17-browser` 523 ✔ · 0 ✘ (1440/1280/1101 ratón, 768 tableta, 430/390/375 móvil, 844×390 apaisado; interfaz clara/oscura; fixtures de 4 y 12 nodos; SW v76 sin red). Medidas antes → después en § Medidas de Chrome: compacta 55 → 72 % (390), ampliada 20 → 40 % de lienzo con el destino del paso entero y legible a zoom 0,6, reproduciendo 61 → 71 %, Propiedades 25 → 37 %; «Volver a editar» a la vista en los cuatro estados y tras colocar; un solo desplazable; 0 objetivos < 40 px y críticos ≥ 44; 0 errores de consola.
- **Regresiones**: batería completa en § Regresión de Chrome; `fluyo-011-browser` sigue con sus 3 fallos previos; `scenario-qa`/`share-browser`/`share-post-qa` en «NOT RUN — environment».
- **CACHE**: `fluyo-static-v75` → **`fluyo-static-v76`**; sin archivos servidos nuevos; todo lo que carga `index.html` sigue precacheado (test).
- **Impacto en MCP/kernel**: ninguno. `model.js`, `config.js` y el resto del kernel idénticos a HEAD (test de alcance); `fluyo-mcp` `npm run check:kernel` → idéntico; no hace falta `sync:kernel` ni desplegar el MCP.
- **git status**: 37 archivos modificados y 4 sin seguimiento (esta tarea y los tres tests nuevos); nada en `fluyo-mcp`. Sin commit, push ni deploy.
- **Revisión manual**: dos bugs corregidos con regresión (fondo propio frente a temas, decisión 152; estado del rail, decisión 153) y la deuda del selector de sentido del flujo rastreada (§ Revisión manual).
- **Deuda encontrada**: (1) nueve comprobaciones asumían que HEAD era `604b344`; corregidas aquí (§ Archivos). (2) `fluyo-011-browser` (3 fallos desde 018.12) y `share-browser` intermitente, sin cambios. (3) Las suites `qa-share-hash`, `share-realistic-size`, `011`, `scenario-qa`, `share-browser` y `share-post-qa` exigen el paquete `playwright` (no `playwright-core`): conviene unificar el `require` con el resto. (4) Apaisado de teléfono (844 × 390): columna de 320 px con una línea de tiempo de ~80 px; 018.18. (5) Pausar/reanudar, Present táctil, Viewer móvil y el diálogo de evento con dedo: 018.18 (D8).

## Handoff

### Estado actual

018.17 implementado, verificado y documentado. **READY FOR COMMIT**. Sin commit, push ni deploy.

### Próximo paso concreto

1. Revisión del responsable de las capturas (`m390-*-compact/expanded/playing/props.png` del browser test) y de las desviaciones.
2. Con OK: commit de fluyo (`CACHE` v76) y deploy del editor; el MCP no cambia.
3. Después: `.ai/tasks/FLUYO-018.18.md` con lo de D8 (pausa/reanudar, Present táctil, Viewer móvil, diálogo de evento, apaisado, navegación de páginas, panel plegable en escritorio, barra contextual) y la unificación del `require` de Playwright en las suites antiguas.

