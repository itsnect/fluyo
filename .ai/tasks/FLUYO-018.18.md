# FLUYO-018.18 — Contar una Historia en cualquier superficie: transporte único, Present táctil, Viewer móvil, páginas y sentido de los puntos

Estado: **IMPLEMENTADO — READY FOR COMMIT** (ver el final). D1–D12 aprobadas por el responsable; D13–D15 reservadas para 018.19/018.20. Sin commit, push ni deploy. `CACHE` v76 → v77.
Fecha: 12 de octubre de 2026 (auditoría y propuesta; implementación el mismo día).
Owner/agente actual: libre.

> Repo público: nada de este documento es confidencial.
> Base: `fluyo` `72bde0b` (= `origin/main`; 018.17 integrado y publicado), árbol limpio, `CACHE` `fluyo-static-v76`.
> Fuentes leídas: `AGENTS.md`, `.ai/ARCHITECTURE.md`, `.ai/DECISIONS.md` (1–153), `FLUYO-018.11` a `018.17`; en código `js/story-playback.js`, `js/scenario-playback.js`, `js/present-story.js`, `js/viewer.js`, `s/index.html`, `css/share.css`, `js/editor-scenarios.js` (`scRun`/`scReset`/`scTick`/`scFollowActive`/`scRenderButtons`/`scRenderNow`/`scSaveEventType`), `js/ui.js` (`renderTabs`, menú de página, Present, superficies), `js/interaction.js` (Present y toque), `js/render.js` (puntos de flujo, overlays de Historia), `js/model.js` (`flowDir`), `index.html` (panel, diálogo de evento, Present, barra inferior), `css/styles.css` y `css/system.css` (Present, páginas, hoja). Los tests que fijan los contratos tocados (013-qa, 014, 016, 018-12, 018-14b, 018-17).
> **Auditoría:** ningún archivo del repositorio cambió salvo esta tarea. **Implementación:** ver «Implementación» al final.

---

## 0. Resumen

018.17 dejó la hoja de Historias con cuatro estados y el lienzo útil. Lo que queda abierto no es «dónde vive cada panel», sino que **la misma Historia se cuenta con tres mandos distintos** (editor, Present y Viewer), ninguno se puede pausar ni recorrer momento a momento, y en táctil **un toque accidental en Present corta la Historia y cambia de diapositiva**. Alrededor hay cuatro defectos medidos y baratos: el Viewer encaja el diagrama antes de mostrar la banda de Historia (diagrama cortado al cargar, también a 1280 × 720), la página activa puede quedar fuera de la vista (o debajo del «＋») con 6 páginas, la ✕ de cada pestaña dice «Cerrar página» y borra, y el sentido de los puntos (`flowDir`) vive en un grupo plegado y fuera de la primera pantalla.

Propuesta: **un solo transporte de Historia** (anterior · reproducir/pausa · siguiente · progreso · detener) y **un solo rótulo del momento sobre el lienzo**, iguales en las tres superficies y colocados según cada una; un **reloj de Historia** que permite pausar y saltar entre momentos **sin tocar el kernel**; Present que nunca navega por un toque; Viewer estable y de una fila; selector de página en móvil; y el sentido de los puntos junto a las puntas, con su nombre real. Lo estructural (apaisado como layout propio, diálogo de evento táctil, panel de escritorio) queda propuesto y medido para 018.19 y 018.20.

## 1. Estado de partida (verificado)

- `git log`: `72bde0b feat: refine mobile UX and editor interaction` = `origin/main`; `git status` limpio; `sw.js` → `fluyo-static-v76`. 018.17 está integrado.
- Lo que **ya está bien y no se toca**: los cuatro estados de la hoja de Historias y su contenido (decisión 146); la zona libre única y el suelo de zoom 0,6 (148); el seguimiento del paso activo en la línea de tiempo y en el lienzo (148); 44/40 px (150); ⚙ contextual, M1–M3 (149); columna de escritorio; Present en apaisado (93–95 % de lienzo); la densidad de píxeles del Viewer; Undo/Redo; 0 errores de consola en todos los recorridos de esta auditoría.

## 2. Método

Chrome real (`channel: "chrome"`, headless) con `playwright-core` **fuera del repo** (scratchpad de la sesión), sirviendo el árbol tal cual con un servidor HTTP efímero de solo lectura, Service Worker bloqueado y red externa bloqueada. Táctil emulado (`hasTouch`, `isMobile`, densidad 2) con `touchscreen.tap`; ratón en escritorio. Fixtures: `test/fixtures/fluyo-017-1-qa-complejo.fluyo.json` (2 páginas, 3 Historias; el 3.er momento tiene tres eventos simultáneos y un fallo), uno de 12 nodos (el de `fluyo-018-17-browser`) y una variante de 6 páginas con nombres reales y largos (página activa: la 3.ª). Scripts `a18/audit.cjs`, `vfit.cjs`, `vband.cjs`; resultados `a18/out/results.json`; capturas `a18/out/shots/` (no versionados).

Viewports: 1440 × 900 y 1280 × 720 (ratón); 768 × 1024 y 1024 × 768 (dedo); 430 × 932, 390 × 844, 375 × 812 (móvil); 844 × 390, 812 × 375, 932 × 430 (apaisado de teléfono). Medidas: % de pantalla que es lienzo (`elementFromPoint` cada 8 px), cajas, objetivos < 44 (dedo) o < 28 (ratón), pantallas de scroll, visibilidad de controles y de la fila activa, efectos de un toque, encaje del diagrama (caja del diagrama frente al lienzo), estados de Playback a lo largo del tiempo.

## 3. Hallazgos (medidos, no inferidos)

### 3.1 Historias / reproducción en el editor

| # | Hallazgo | Evidencia |
|---|---|---|
| H1 | **No existe pausar/reanudar** en ninguna superficie | 0 controles de pausa en 5 viewports × 8 fotogramas; el único «Pausa» es la animación ambiental |
| H2 | **No hay navegación por momentos**: tocar una fila de la línea de tiempo mientras se reproduce no hace nada; tocar el lienzo tampoco | 1440/768/844: tras tocar la última fila, `scStatus` sigue `running` y el cursor avanza (4,4–4,5 s) |
| H3 | **La pausa es posible sin tocar el kernel.** `FluyoScenarioPlayback.tick(pb, nowReal)` es función pura del reloj que recibe; todos los tiempos de partículas y cues se derivan de `startedAtReal + ev.at` («para que saltos del cursor conserven la duración visual», `scenario-playback.js`). El editor (`scRun`, `scTick`, `buildScenarioRenderState`) y el Viewer pasan `performance.now()` | Lectura de código. Saltar hacia atrás = volver a `FluyoStory.start` (determinista) con el origen desplazado; hacia delante = mover el origen |
| H4 | **El estado «reproduciendo» de la hoja móvil crece con el texto del momento**: el bloque «Reproduciendo» comparte fila con Ampliar (186–201 px de ancho) y el 3.er momento («Notificación · Confirmación · Procesamiento · No se completó · Banco no está disponible») ocupa 4 líneas | Hoja 125 px en compacta → **193 px (390) / 213 px (375)** reproduciendo; lienzo **72 → 64 % (390) y 71 → 60 % (375)**. 018.17 midió 71/70 % en un momento corto |
| H5 | Terminada: en escritorio hay **tres salidas** (↻ Repetir, «Terminar», «← Volver a editar») y el editor sigue congelado (Undo apagado) hasta pulsar «Terminar»; en móvil, «Terminar» está implícito en Ampliar (018.17) | Lista de botones de la columna en 1440/768/844; `btnUndo.disabled` = true |
| H6 | El progreso cuenta **momentos** («2 / 4») mientras la línea de tiempo enseña 7 filas; Present usa los mismos momentos (puntos); el Viewer no enseña progreso | `scNowProgress`, `psDots`, `#story` |
| H7 | Apaisado (844 × 390): la columna de Historias deja **79 px** de línea de tiempo (menos de una fila) y el lienzo en el 45 % | `story.l844` |

### 3.2 Present

| # | Hallazgo | Evidencia |
|---|---|---|
| H8 | **Un toque en el lienzo con el dedo avanza de diapositiva y corta la Historia** (P2-5 de 018.11, sigue vivo). Con ratón no | 768, 390, 375, 844 × 390, 812 × 375: `doc.cur` 0 → 1 y fase `playing` → `ready`. `interaction.js` (`if(presenting && wasTap && touch) nextSlide()`); `docs/index.html` lo documenta («en táctil, un toque avanza») y `fluyo-013-qa-browser` lo afirma |
| H9 | Mando con objetivos de **38 px** (✕ Salir 83 × 38) y en vertical **se parte en dos filas (94 px)** | 390/375 |
| H10 | «▶» significa a la vez **diapositiva siguiente** y **Reproducir**; reproduciendo, «▶» (página) queda pegado a «■ Detener». Terminada hay **dos salidas** que hacen lo mismo (`psEdit` y `prExit` → `exitPresent`) | `index.html` `#presentBar`, `ui.js` |
| H11 | Dos progresos con unidades distintas en la misma pantalla: «1 / 2» (páginas) y puntos (momentos) | captura `l844-p2-reproduciendo` |
| H12 | En vertical el diagrama horizontal queda a zoom **0,43 (390) / 0,41 (375)** y ocupa ~17 % del alto; en apaisado, 0,66 / 0,62 y 93–95 % de lienzo | `present.*` |
| H13 | Reproducir es oliva en Present y terracota en el editor | CSS `#psPlay` (`--accent`) frente a `#scRun` |

### 3.3 Viewer móvil

| # | Hallazgo | Evidencia |
|---|---|---|
| H14 | **Encaja el diagrama antes de mostrar la banda de Historia** (`bootViewer`: `fitView()` y después `setViewerPhase("ready")` → `storyRefresh()`): al cargar, el diagrama queda **cortado** | 844 × 390: borde inferior 303 px en un lienzo de 178; 812 × 375: 288 en 163; **1280 × 720: 562 en 508**. «Encajar» lo arregla (zoom 0,54 / 0,49 / 1,49) |
| H15 | **No se reencaja al girar** el teléfono | 390 → 844 × 390 y al revés: zoom igual, diagrama fuera |
| H16 | **La banda de Historia cambia de alto durante la reproducción** cuando aparece una consecuencia: el lienzo salta | 375: banda 123 → 148 px, lienzo 565 → 540; 844 × 390: 125 → 150, lienzo **178 → 153 px (39 %)** |
| H17 | Cabecera de **dos filas (87 px)** a 390/375 con dos o más páginas; pestañas de 30 px; «Hecho con Fluyo» ocupa una franja fija de 37 px | `viewer.fx4.m390/m375` |
| H18 | **En el Present del Viewer no se puede reproducir la Historia** (`enterPresent` → `storyReset`; `storyPlay` sale si `presenting`) | `pres.story = "ready"`, `#story` oculto |
| H19 | Lienzo: 77 % (1440), 80 % (768), 71/70 % (390/375), **45 % (844 × 390)**. Con un diagrama horizontal en vertical, zoom 0,45 → etiquetas de ≈ 6 px; con el de 12 nodos, 0,57 | `viewer.*` |
| H20 | Tipografía y contraste ya son los del sistema (018.14a): no son el problema. El problema es el reparto de alto y la falta de mando | — |

### 3.4 Diálogo / creación de eventos

| # | Hallazgo | Evidencia |
|---|---|---|
| H21 | **40 de 43 controles < 44 px con dedo**, entre ellos los que cierran o confirman: ✕ 29 × 29, «Cancelar» 80 × 29, «Crear evento» 108 × 29; segmentados 34–38; chips de la frase 27; «+ Origen/+ Destino» 24; «Más detalles» 26 | `dialog.m390/m375/t768` |
| H22 | En móvil es pantalla completa y la **vista previa va primero**: el campo «Nombre» empieza en y = 272 px | captura `m390-e1-crear` |
| H23 | Pantallas de scroll: 1,31 (conexión) / 1,64 (elemento con apariencia) a 390; 1,43 / 1,79 a 375; **en apaisado el cuerpo útil mide 261 px: 3,1 / 3,8 pantallas** (sin contar el teclado virtual, que aquí no se puede emular) | `dialog.l844` |
| H24 | Tras «Crear evento» el aviso dice **«Arrástralo a una conexión.»** también con el dedo, y no se entra en colocación: hay que encontrar la ficha y tocarla | `scSaveEventType` |
| H25 | Los segmentos vacíos de la frase se pintan como cajas vacías; el subtítulo «Disponible en todo este proyecto.» ocupa la cabecera | captura |

### 3.5 Navegación de páginas (6 páginas, activa la 3.ª)

| Viewport | Pestañas a la vista | Activa | «＋» | Problema |
|---|---|---|---|---|
| 1440 / 1280 | 6 / 6 | nombre visible | sí | ✕ en **cada** pestaña con título «Cerrar página» que **elimina** la página; con ratón, renombrar = doble clic + `prompt()`/`alert()`; el ▾ solo aparece con puntero grueso |
| 768 × 1024 | 2 / 6 (desborde 733 px) | **fuera de la vista** | **fuera** | sin desplazamiento a la activa; «＋» solo es fijo en ≤ 700 |
| 1024 × 768 | 3 / 6 (477 px) | visible | **fuera** | ídem |
| 844 × 390 | 2 / 6 (657 px) | **fuera** | **fuera** | ídem |
| 390 × 844 | 3 / 6 índices | «03 ▾» sin nombre | sí | nunca se ve un nombre de página |
| 375 × 812 | 2 / 6 índices | **debajo del «＋» fijo** | sí | no se sabe en qué página se está (captura `m375-g1-paginas`) |

Renombrar y eliminar sin teclado funcionan en móvil y tableta (menú de la página, 018.12).

### 3.6 Apaisado de teléfono (844 × 390, 812 × 375, 932 × 430)

Caen en el layout de **tableta** (por anchura > 700): cabecera 51 + barra inferior 45 = **96 px de 390 (25 %)**; rail vertical de 56 px que desplaza (las últimas formas quedan fuera); columna de Propiedades de 216 px **siempre visible**, también sin selección.

| | 844 × 390 | 812 × 375 | 932 × 430 | 1024 × 768 (referencia) |
|---|---|---|---|---|
| Editar | 48 % | 46 % | 52 % | 62 % |
| Propiedades (nodo) | 4,5 pantallas de scroll | 4,8 | 4,0 | 2,0 |
| Historias | 45 %; línea de tiempo 79 px | 43 %; 79 px | 49 %; 79 px | 59 %; 234 px |
| Reproduciendo | 45 % | 43 % | 49 % | 59 % |
| Present | 94 % | 93 % | 95 % | 97 % |
| Diálogo de evento | cuerpo 261 px, 3,1–3,8 pantallas | — | — | — |

### 3.7 Panel de propiedades en escritorio

288 px; un nodo ocupa **1,16 pantallas a 1440 y 1,49 a 1280**; una conexión, igual. Grupos por defecto: nodo = Texto ▾ (5 filas) · Forma y color ▾ (4) · Capas y aparición ▸ · Animación del lienzo ▸; conexión = Texto ▾ (3) · Recorrido ▾ (3) · Trazo ▾ (5) · Flujo ▸ (4) · Animación del lienzo ▸. Lo que da sensación de formulario: **filas etiqueta-izquierda/control-derecha para todo**, 4–6 `select` (Forma, Tipografía, Posición del texto, Estilo de borde / Ruta, Sale por, Entra por), y **tres bloques de color por nodo** (texto, borde, relleno), cada uno con dos filas de muestras, «Más colores» y un pozo «Personalizado» (≈ 100 px cada uno: el mayor consumo de alto). «Animación del lienzo» es un ajuste del **documento** y en escritorio sigue al final del panel de selección (en móvil ya vive en «Más», M1), mientras «Lienzo ▾» reúne el resto de ajustes del documento. Sin selección la columna mantiene sus 288 px para la ayuda.

### 3.8 Sentido del flujo (`#flowSel` → `edge.flowDir`)

- **Modelo**: `flowDir ∈ {normal, reverse, alternate}` (formato v5, `update_connection` del MCP). Solo lo lee `render.js` para el **sentido de los puntos animados** de la conexión (848–856). No afecta a la ruta, a las puntas (`startArrow`/`endArrow`, datos independientes), al SVG/PNG estático ni a las Historias.
- **Cuándo se ve**: solo con `animated` activo, sin «pelota única» (`settings.single`), fuera de una reproducción de Historia (`!rs.scenarioRuntime`) y con la animación ambiental en marcha. No respeta `prefers-reduced-motion` (los puntos siguen moviéndose; fuera de alcance aquí).
- **Descubribilidad**: está en la fila «Flujo de puntos» del grupo **Flujo, plegado por defecto** (decisión 136): dos niveles (seleccionar la conexión, abrir «Flujo») y, abierto, queda a ≈ 940 px del inicio de un panel de 806 px a 1440 × 900 (≈ 510 px en la hoja móvil de 338): **fuera de la primera pantalla incluso abierto**. La fila se enseña aunque «Puntos animados» esté apagado (no hace nada). El nombre «Flujo de puntos» con opciones «Normal → / Inverso ← / Alterno ⇄» no dice «dirección», y las flechas tipográficas de las opciones se confunden con las puntas, que viven en otro grupo («Trazo»).

## 4. Criterio de diseño de este slice

1. **Una Historia, un mando.** Editor, Present y Viewer cuentan la misma Historia con el mismo transporte (mismos controles, mismo orden, mismas palabras, mismos iconos) y el mismo rótulo del momento. Cambia dónde se coloca, no qué es.
2. **El momento se cuenta sobre el lienzo; el mando vive abajo o al lado.** El rótulo del momento es el mismo componente que el encabezado de Present (material inverso, una línea), y su alto no cambia con el texto.
3. **Nada destruye por accidente.** Un toque nunca detiene una Historia ni cambia de página en Present.
4. **El alto de un estado no depende del texto.** Lo que se reproduce no hace saltar el lienzo.
5. **Se quita chrome antes que encoger controles.** 44 px para lo que cambia de estado o lo cierra; el sitio sale de quitar cajas, rótulos y duplicados.
6. **Sin semántica nueva.** El reloj de Historia es presentación: Trace, Steps, `at` y Playback no cambian. `flowDir` sigue siendo lo que es; se le da su nombre y su sitio.
7. **Calm Instrumentation**: iconos del sprite (sin glifos baratos en el mando), serif para el momento y los nombres, mono para progreso y estados, una caja por propósito; sin marcas personales ni logos añadidos.

## 5. Propuesta

### 5.1 El modelo unificador: transporte y rótulo del momento

```text
                       ┌──────────── rótulo del momento (sobre el lienzo, arriba, una línea) ────────────┐
                       │  Procesamiento · No se completó: Banco no está disponible           2 / 4      │
                       └──────────────────────────────────────────────────────────────────────────────────┘
   transporte:   [⏮ momento anterior]  [▶ Reproducir | ❚❚ Pausa | ▶ Seguir | ↻ Repetir]  [⏭ momento siguiente]   [■ Detener]
   salidas (aparte, propias de cada superficie):  Editor «← Volver a editar» · Present «✕ Salir» · Viewer «Abrir en Fluyo» (cabecera)

   estados:  lista ──▶──▶ reproduciendo ⇄ en pausa ──(fin)──▶ terminada (cabezal al final; ↻ Repetir)
             cualquiera ──■ Detener──▶ lista          ⏮/⏭ y tocar una fila = saltar a ese momento (sin cambiar play/pausa)
```

| Superficie | Rótulo del momento | Transporte | Línea de tiempo |
|---|---|---|---|
| Editor escritorio/tableta | sobre el lienzo (sustituye al bloque «Reproduciendo» de la columna) | fila superior de la columna (sustituye a Reproducir/Detener/Terminar) | debajo, con la fila activa seguida (ya) y **tocar una fila = saltar** |
| Editor móvil (hoja) | sobre el lienzo | hoja de dos filas de alto fijo: A = `[⏮][❚❚][⏭] 2/4 ··· [⌃]`, B = `[■ Detener] ··· [← Volver a editar]` | en Ampliar (ya), tocar = saltar |
| Present (editor y Viewer) | encabezado actual (`#presentStory`, ya es este componente) | barra inferior: transporte · `‹ 1/2 ›` (páginas) · ✕ | — |
| Viewer | sobre el lienzo | banda inferior de **alto fijo** (una fila) | — |

Presupuestos de ancho (sin encoger nada): hoja móvil fila A = 3 × 44 + progreso 40 + Ampliar 44 + huecos ≈ 236 ≤ 343 (375); fila B = 96 + 151 ≈ 255. Barra de Present a 375 = transporte 140 + páginas 128 + ✕ 44 + filetes y huecos ≈ 350 ≤ 359: **una fila** (antes 2, 94 px); por debajo de 360 px puede partir en dos. Banda del Viewer = `[⏮][▶ Reproducir historia][⏭] 2/4` ≈ 336 ≤ 343.

### 5.2 Cambios propuestos (con sus campos)

#### C1 — Reloj de Historia: pausa, reanudar y saltar entre momentos

- **Problema**: H1, H2 (no se puede pausar ni ir a un momento, en ninguna superficie).
- **Evidencia**: H3 (la proyección ya es función pura del reloj; los saltos ya estaban previstos en `processEvent`).
- **Solución**: `FluyoStoryClock` en un archivo clásico **nuevo y fuera del kernel**, `js/story-clock.js` (puro, sin DOM): `now()` (tiempo que se pasa a `tick`/`renderState`), `pause()`, `resume()` (desplaza el origen lo que duró la pausa) y `seek(i)` sobre los momentos de `FluyoStory.moments` (la misma unidad que el progreso «2 / 4» y los puntos de Present): reconstruye con `FluyoStory.start(page, sc, ahora − momentos[i].at)` y conserva reproduciendo/pausa. Lo usan `editor-scenarios.js` (y por él Present) y `viewer.js`. El estado «en pausa» es una marca del reloj, no un `scStatus` nuevo: `isScenarioPlaybackActive()` y las 21 comparaciones de `scStatus` no cambian; el editor sigue congelado en pausa como al reproducir. Espacio alterna pausa durante una Historia (los puntos ambientales ya están suprimidos en ese momento); fuera de ella sigue siendo la pausa ambiental. Con la Historia en pausa, `scTick` deja de pedir fotogramas propios.
- **Impacto móvil / escritorio / Viewer-Present**: los tres ganan pausa y navegación con el mismo código.
- **Documento/model**: no. **`CACHE`**: sí (archivo servido nuevo + precache). **MCP/kernel**: **no** (`story-playback.js` y `scenario-playback.js` intactos; `check:kernel` idéntico).
- **Tests**: vm — pausa congela la salida de `tick` y la posición de cada partícula; reanudar continúa desde el mismo cursor; `seek(i)` deja `nodeStates`, `logEvents` y `cursorVirtual` iguales a una ejecución continua muestreada en `momentos[i].at`; «Trace antes = Trace después»; determinismo. Chrome — pausar mantiene el token quieto ≥ 1 s en los tres sitios; ⏮/⏭ y tocar una fila mueven el cursor al instante exacto del momento.
- **Riesgos**: el parpadeo de «Parpadear» usa el reloj ambiental (`render.js`), así que en pausa sigue latiendo (se acepta: no se toca `render.js`); saltar hacia atrás vuelve a ejecutar el motor (barato; mismo `guard`).

#### C2 — Transporte único y rótulo del momento

- **Problema**: H4–H6, H10, H11, H13: tres mandos para la misma Historia, salidas duplicadas, alto que depende del texto, glifos ambiguos.
- **Evidencia**: §3.1–3.3.
- **Solución**: §5.1. Mismos controles y textos en las tres superficies; iconos del sprite (`i-play`, `i-pause`, `i-stop`, `i-replay` ya existen; se añaden dos: momento anterior/siguiente). Los glifos siguen como texto accesible (`scGlyphText`, contratos de tests). Rótulo del momento de **una línea** (serif para el momento, mono para la consecuencia, elipsis; texto completo en `aria-live`). «**Detener**» es la única palabra para volver a «lista» en cualquier estado (sustituye a «Terminar», D5). El bloque «Reproduciendo» (`#scNow`) deja de ser una caja de la hoja/columna: su contenido pasa al rótulo (el filete oliva del lienzo se queda). La hoja móvil reproduciendo mide lo mismo que la compacta (≈ 125 px) en cualquier momento. La zona libre (`visibleCanvasRect`) descuenta el rótulo, así el seguimiento del paso activo no lo deja debajo.
- **Impacto móvil**: lienzo reproduciendo ≥ 70 % en todos los momentos (hoy 64/60 % en el 3.º). **Escritorio**: la columna gana alto para la línea de tiempo (sin la caja de 97 px). **Viewer/Present**: mismo mando y rótulo.
- **Documento/model**: no. **`CACHE`**: sí. **MCP/kernel**: no.
- **Tests**: DOM — mismos controles/orden/textos en editor, Present y Viewer; estados lista/reproduciendo/en pausa/terminada; alto de la hoja constante a lo largo de los 4 momentos del fixture complejo. Se adaptan `016-browser` y `018-14b` («Terminar»), `018-17` (bloque `#scNow`, alturas), `013-browser`/`013-qa`.
- **Riesgos**: revisa tres días después detalles aprobados en 018.17 (bloque «Reproduciendo», «Terminar» fuera de la hoja); el rótulo sobre el lienzo tapa su franja superior (mitigado por la zona libre).

#### C3 — Present táctil

- **Problema**: H8–H12.
- **Solución**: (1) un toque sin arrastre en el lienzo **nunca** cambia de página ni detiene: muestra el mando si estaba apartado; las páginas se cambian con `‹ ›`, flechas, AvPág (teclado sin cambios); (2) objetivos de 44 px; (3) una sola salida (✕ con nombre accesible «Salir»; desaparece `psEdit` como botón duplicado); (4) páginas `‹ 1/2 ›` separadas del transporte por un filete y con chevrons del sprite, no «◀ ▶»; (5) Reproducir con el mismo material que en el editor; (6) sin forzar orientación (en vertical se ve pequeño, pero girar es decisión de quien presenta).
- **Impacto móvil**: el mando cabe en una fila a 390/375 y un toque ya no corta nada. **Escritorio**: igual salvo iconos y una salida. **Viewer**: comparte el mando (C4).
- **Documento/model**: no. **`CACHE`**: sí. **MCP/kernel**: no.
- **Tests**: Chrome — en 768/390/375/844 × 390/812 × 375, tocar el lienzo reproduciendo deja `doc.cur` y la fase iguales; mando ≥ 44; una fila a ≥ 375. Se adapta `fluyo-013-qa-browser` («tap avanza» → «tap no navega», misma intención: el toque no destruye), y `docs/index.html` (frase de Present).
- **Riesgos**: cambia un comportamiento documentado (D7); quien presentaba diapositivas sin Historia tocando la pantalla tendrá que usar `›`.

#### C4 — Viewer móvil

- **Problema**: H14–H19.
- **Solución**: (1) encajar **después** de colocar la banda y volver a encajar cuando cambia el tamaño del lienzo (giro, barra del navegador) si quien mira no ha movido la vista; (2) cabecera de **una fila** siempre: logo · página ▾ (selector con el nombre en serif, solo con ≥ 2 páginas) · Encajar · Presentar · Abrir en Fluyo; con dedo, sin «− +» (el pellizco ya existe); (3) banda de Historia = transporte de C2 de **alto fijo**, y el momento en el rótulo sobre el lienzo; (4) el Present del Viewer reproduce la Historia con el mismo mando que el del editor; (5) objetivos de 44 con dedo; (6) «Hecho con Fluyo» según D9.
- **Impacto**: vertical 70 → ≈ 78 % de lienzo estable; **apaisado 45 % (39 % con consecuencia) → ≈ 70 %** (cabecera 50 + banda ≈ 60); 1280 × 720 deja de cargar cortado.
- **Documento/model**: no (el Viewer no escribe nada). **`CACHE`**: sí (`s/index.html`, `css/share.css`, `js/viewer.js`). **MCP/kernel**: no.
- **Tests**: Chrome — diagrama dentro del lienzo al cargar en 7 viewports; reencaje al girar; alto de la banda constante durante la reproducción; cabecera de una fila a 390/375 con 2 y 6 páginas; Historia reproducible en Present. Se adaptan `fluyo-014-browser`, `016-browser` (`#stKicker`), `018-14a-browser`, `share-browser` (pestañas del Viewer).
- **Riesgos**: la CSP del Viewer no admite estilos en línea (todo en `share.css`/`system.css`); el selector de página sustituye a `#pgTabs` como botones sueltos (tests).
- **Fuera (018.19+)**: en vertical, con un diagrama que no cabe legible, seguir el destino del paso activo a zoom ≥ 0,6 como hace el editor (hoy etiquetas de ≈ 6 px).

#### C5 — Navegación de páginas

- **Problema**: §3.5.
- **Solución**: **≤ 700 px**: la tira de índices se sustituye por **un selector** «03 Conciliación noc… ▾» (índice mono + nombre serif con elipsis) que abre el menú de página ampliado: lista de páginas (índice + nombre, la activa en oliva, filas de 40 px), «＋ Nueva página» al final y, para la activa, «Renombrar…» y «Eliminar página» (los de hoy, con la misma confirmación). **> 700 px**: se conserva la tira, pero la activa se trae siempre a la vista, «＋» queda fuera del desplazable (siempre visible), los nombres se acotan con elipsis y `title`, **sin ✕ en las pestañas** (eliminar desde ▾, que aparece también con ratón en la activa) y el doble clic abre el renombrado en línea del menú (sin `prompt()`/`alert()`).
- **Impacto móvil**: la página activa siempre identificada por su nombre; crear pasa a dos toques (D10). **Escritorio**: una acción destructiva menos al lado de cada nombre; mismas vías. **Viewer/Present**: el Viewer usa el mismo patrón de selector (C4).
- **Documento/model**: no (`createPageIn`, `renamePageIn`, `requestDeletePage` sin cambios). **`CACHE`**: sí. **MCP/kernel**: no.
- **Tests**: Chrome con 6 páginas en 7 viewports: activa visible y con nombre legible (tira o selector), «＋» a la vista (> 700) o en el menú (≤ 700), renombrar y eliminar sin teclado y sin diálogos nativos de texto. Se adaptan los 9 archivos que usan `.tab .x`/`.pgMore` (018-5, 018-7a, 018-7c, 018-7d, 018-12 ×2, 018-13, 018-14b, 018-17) con la misma intención.
- **Riesgos**: churn de tests; quien borraba con la ✕ tiene un toque más.

#### C6 — Sentido de los puntos

- **Problema**: §3.8.
- **Decisión de ubicación, basada en el modelo y en la interacción real**:
  - *Control directo sobre la conexión*: **descartado**. Añade un instrumento al lienzo (018.16: una forma por operación), no es descubrible con el dedo y es justo el tipo de chrome que hace genérico al editor; además el dato solo existe mientras los puntos se mueven.
  - *Control contextual en la cabecera del panel*: **descartado**. Subiría al primer nivel de toda conexión un ajuste de la animación decorativa.
  - *«Trazo»*: **sí, pero nombrando lo que es**. Es donde se busca «la dirección» (junto a las puntas), así que ahí debe estar; para no confundir dos datos distintos, dentro de «Trazo» se forma un bloque **Dirección** con dos partes con nombre propio: **Puntas** (inicio · final, los interruptores de hoy) y **Puntos en movimiento** (interruptor = `animated`) con **Sentido** (segmentado de 3, visible solo si los puntos se mueven): «Hacia el destino» = `normal`, «Hacia el origen» = `reverse`, «Ida y vuelta» = `alternate`, con flechas del sprite. «Color de puntos» pasa al grupo plegado, que se llama **Puntos** (velocidad, puntos por conexión, puntos globales, color): «Trazo» no crece (sale un bloque de muestras de ≈ 100 px, entran dos filas).
- **Impacto móvil / escritorio**: el sentido queda a un nivel (seleccionar la conexión) y, a 1440, en la primera pantalla. **Viewer/Present**: ninguno (el render no cambia).
- **Documento/model**: **no** (mismo `flowDir`, mismos valores). **`CACHE`**: sí. **MCP/kernel**: no.
- **Tests**: ids conservados (`#flowSel` sigue siendo el control nativo sincronizado bajo el segmentado, decisión 36; `#rowFlow`, `#animChk`, `#arrSChk`, `#arrEChk`, `#dotSw`); con una conexión seleccionada, «Sentido» visible sin abrir grupos y oculto con los puntos apagados; cambiar el segmentado escribe `flowDir` con un Undo. Se adaptan `018-14b.test` (inventario y grupos por defecto) y `018-14b-browser`.
- **Riesgos**: cambia el reparto de grupos de la decisión 136; «Puntos» sustituye a «Flujo» como nombre de grupo (`data-group`).

#### C7 (018.19) — Apaisado de teléfono como layout propio

- **Problema/evidencia**: §3.6 (48 % de lienzo editando, 79 px de línea de tiempo, 4,5 pantallas de Propiedades, diálogo de 261 px).
- **Solución (dirección)**: un tercer layout por **altura** (`max-height: 500px` y apaisado), no una escala del vertical. **Desaparecen**: la barra inferior (páginas → selector en la barra superior; zoom → pellizco; Historias/Presentar → barra superior), los rótulos de texto de la cabecera, «MODO HISTORIA» y la columna de Propiedades sin selección. **Permanecen**: una barra superior de 44 px (logo · Deshacer · Rehacer · página ▾ ··· Historias · Presentar · Compartir · Más) y el rail vertical. **Propiedades**: hoja lateral derecha de 300 px solo con selección (⚙ contextual, como en móvil). **Historias**: hoja lateral con la gramática móvil de 018.17 (compacta/ampliada/reproduciendo) a altura completa: la línea de tiempo pasa de 79 a ≈ 240 px. **Present**: como hoy + C3. **Diálogo**: pantalla completa sin columna de vista previa.
- **Estimación**: editar 48 → ≈ 83 % de lienzo; Historias 45 → ≈ 57 %.
- **Impacto**: CSS + `placeChrome`/`isSheetLayout` (un `isShortLayout`), `visibleCanvasRect` con hoja lateral. **Documento/model**: no. **`CACHE`**: sí. **MCP/kernel**: no. **Tests**: el apaisado de `018-17-browser` cambia de expectativas; matriz 844/812/932. **Riesgos**: una combinación más de layouts; dispositivos con barra del navegador variable (`dvh`).

#### C8 (018.19) — Diálogo de evento táctil y flujo de creación

- **Problema/evidencia**: H21–H25.
- **Solución**: 44 px para ✕, Cancelar, Crear/Guardar, opciones de los segmentados y «Ver ejemplo»; 40 para chips de la frase, símbolos y «Más detalles». En móvil, **Nombre primero** y la vista previa reducida a una fila «Así se verá · ▶ Ver ejemplo» desplegable; cabecera de 56 px solo con el título (el subtítulo pasa a ayuda bajo el nombre); pie con `safe-area` que no se pierda con el teclado (QA en dispositivo). Tras crear desde el taller, **se entra en colocación** con el evento nuevo («Toca la conexión donde ocurre» · Cancelar) y el aviso deja de decir «Arrástralo» con el dedo (D14). Chips de efecto ◎ T ✦ ◐ ✺ ● y la × pasan al sprite (los símbolos de evento son contenido del usuario y no se tocan).
- **Impacto**: móvil y apaisado sobre todo; escritorio gana el flujo de colocación. **Documento/model**: no. **`CACHE`**: sí. **MCP/kernel**: no. **Tests**: `011`, `015`, `017-3` (ids conservados), nuevos de objetivos y del flujo crear → colocar. **Riesgos**: el editor de frase con segmentos vacíos necesita su propio rediseño (018.20+).

#### C9 (018.20) — Panel de propiedades en escritorio

- **Problema/evidencia**: §3.7.
- **Solución**: (1) **control de color compacto**: una fila por propiedad (muestra + nombre, p. ej. «Piedra», «Automático») que abre un popover con la paleta, «Personalizado» y «Cuentagotas» (mismas rejillas y mismos ids dentro): un nodo a 1280 pasa de ≈ 1,5 a ≈ 1,0 pantallas; (2) controles visuales donde hay pocas opciones: Ruta (2), Estilo de borde (3), Posición del texto y Sale/Entra por (rosa de 5), Forma (los iconos del rail); `select` solo para listas (Tipografía); (3) cabecera con el nombre de la selección en serif + metadato mono; (4) «Animación del lienzo» al popover «Lienzo ▾» también en escritorio (todos los ajustes del documento en un sitio); (5) columna plegable cuando no hay selección (preferencia del navegador, como la interfaz oscura). Se descarta una barra flotante sobre el lienzo: compite con el diagrama.
- **Impacto**: escritorio (y la hoja móvil hereda el control de color). **Documento/model**: no. **`CACHE`**: sí. **MCP/kernel**: no. **Tests**: inventario del panel (`018-14b`), tests que pulsan muestras por id. **Riesgos**: el mayor churn de tests de propiedades; requiere decidir el plegado (D15).

### 5.3 Relación Historias ↔ Present ↔ Viewer (después de la propuesta)

```text
                 FluyoStory (kernel, sin cambios) ─── FluyoStoryClock (nuevo, fuera del kernel: pausa · seguir · saltar)
                        │                                     │
      ┌─────────────────┼─────────────────────┬───────────────┘
   Editor (modo Historia)               Present (editor)                Viewer (/s/) y su Present
   rótulo sobre el lienzo               rótulo arriba (ya)               rótulo sobre el lienzo
   transporte en la columna/hoja        transporte + ‹ 1/2 › + ✕         banda de alto fijo / misma barra en Present
   línea de tiempo: seguir y saltar     —                                —
   salida: ← Volver a editar            salida: ✕ Salir                  salida: Abrir en Fluyo
```

## 6. Alcance propuesto

**018.18 (implementación, tras aprobación)** — tres fases verificables por separado:

- **Fase A** (independiente y pequeña): C5 páginas · C6 sentido de los puntos.
- **Fase B**: C1 reloj · C2 transporte y rótulo en el editor (columna y hoja).
- **Fase C**: C3 Present táctil · C4 Viewer móvil.

**018.19**: C7 apaisado como layout propio · C8 diálogo de evento táctil y crear → colocar.
**018.20**: C9 panel de escritorio (color compacto, controles visuales, plegado).
**Después (018.21+)**: momentos como «pasos» de la diapositiva en Present (avanzar = siguiente momento, luego siguiente página); teclas para momentos; seguir el destino activo en el Viewer vertical; editor de la frase del evento; `prefers-reduced-motion` en los puntos de flujo; el Viewer con la interfaz oscura; `prefers-color-scheme`; los `confirm`/`alert` nativos restantes (20 usos); unificar el `require` de Playwright en las suites antiguas; `fluyo-011-browser` (3 fallos previos).

## 7. Decisiones que necesito antes de implementar

**Para 018.18**

- **D1 · Alcance**: 018.18 = C1–C6 en tres fases (A, B, C); C7–C8 en 018.19; C9 en 018.20. *Recomendado.* Alternativa: 018.18 solo C1–C4 y C5–C6 aparte.
- **D2 · Dónde vive el reloj**: (a) `js/story-clock.js`, archivo nuevo fuera del kernel *(recomendado: el kernel y el MCP no cambian)*; (b) dentro de `story-playback.js` (kernel → `kernelId` nuevo y `sync:kernel` en fluyo-mcp, sin cambio de contrato); (c) duplicado en editor y Viewer.
- **D3 · Unidad de navegación**: el **momento** (grupo por `at`, la unidad del progreso y de los puntos de Present) *(recomendado)*, no el Step.
- **D4 · Rótulo del momento sobre el lienzo** en las tres superficies, y el bloque «Reproduciendo» deja de ser una caja de la hoja/columna (actualiza la decisión 139; el filete oliva se queda) *(recomendado)*. Alternativa: mantener el bloque con alto fijo y una línea.
- **D5 · «Detener»** como única palabra para volver a «lista» en cualquier estado, también terminada (actualiza la 132: «Terminar» desaparece; en móvil vuelve un «■ Detener» visible en la fila B, que 018.17 había retirado por falta de sitio) *(recomendado)*.
- **D6 · Tocar una fila de la línea de tiempo** durante la reproducción o la pausa = saltar a su momento (sin editar nada) *(recomendado)*.
- **D7 · Toque en Present**: (a) nunca navega ni detiene; enseña el mando *(recomendado)*; (b) avanza solo si la página no tiene Historia. Cambia la frase de `docs/` y el test `013-qa`.
- **D8 · Mando de Present**: una sola salida «✕» (sin «← Volver a editar» duplicado) y páginas `‹ 1/2 ›` separadas del transporte *(recomendado)*.
- **D9 · «Hecho con Fluyo» en el Viewer**: (a) se mantiene en vertical y escritorio y se oculta en apaisado corto (el logo ya enlaza) *(recomendado)*; (b) se mantiene siempre; (c) se integra en la banda.
- **D10 · Páginas en móvil**: selector único con «＋ Nueva página» dentro del menú (crear = dos toques) *(recomendado)*; alternativa: selector + «＋» a la vista.
- **D11 · Pestañas en escritorio**: sin ✕; eliminar y renombrar desde ▾ (también con ratón); doble clic = renombrado en línea, sin `prompt()` *(recomendado)*.
- **D12 · Sentido de los puntos**: bloque «Dirección» en «Trazo» (Puntas · Puntos en movimiento · Sentido), «Color de puntos» al grupo plegado que pasa a llamarse «Puntos»; textos «Hacia el destino / Hacia el origen / Ida y vuelta» *(recomendado)*. Alternativas: solo mover `#rowFlow` a «Trazo» tal cual; dejarlo en «Flujo» abierto por defecto.

**Dirección para 018.19–018.20** (aprobar ahora el rumbo, no el detalle)

- **D13** · Apaisado de teléfono como tercer layout por altura con hojas laterales (C7).
- **D14** · Crear un evento desde el taller entra directamente en colocación (C8).
- **D15** · Panel de escritorio: control de color compacto, «Animación del lienzo» al popover «Lienzo» y columna plegable sin selección (C9).

## 8. Criterios de aceptación de 018.18 (si se aprueba como se propone)

| Criterio | 1440 | 1280 | 768 | 390 | 375 | 844 × 390 |
|---|---|---|---|---|---|---|
| Pausa: cursor y posición de cada partícula constantes ≥ 1 s; reanudar continúa desde el mismo cursor (± 1 fotograma); editor congelado en pausa | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| ⏮ / ⏭ / tocar fila: cursor = `at` del momento; estado igual al de una ejecución continua en ese instante (vm) | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| Mismo transporte (controles, orden, textos) en editor, Present y Viewer | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| Hoja móvil reproduciendo: alto constante en los 4 momentos del fixture complejo y lienzo ≥ | — | — | — | 70 % (hoy 64) | 68 % (hoy 60) | — |
| Destino del paso activo dentro de la zona libre menos el rótulo | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| Present táctil: tocar el lienzo reproduciendo no cambia `doc.cur` ni la fase; mando ≥ 44 con dedo; una fila a ≥ 375; una salida | — | — | ✔ | ✔ | ✔ | ✔ |
| Viewer: diagrama dentro del lienzo al cargar y tras girar; banda de alto constante; cabecera de una fila (2 y 6 páginas); Historia reproducible en su Present; lienzo en apaisado ≥ 65 % (hoy 45/39) | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| Páginas (6): activa visible y con nombre legible; «＋» a la vista (> 700) o en el menú (≤ 700); sin ✕; renombrar sin `prompt()` | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| Sentido de los puntos: visible sin abrir grupos con una conexión seleccionada; oculto con los puntos apagados; a 1440 en la primera pantalla | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| Objetivos: críticos ≥ 44 (dedo), filas ≥ 40, ratón ≥ 28; ningún control más pequeño que hoy | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| `model.js`, `config.js`, kernel (`story-playback.js`, `scenario-playback.js`, `scenario-engine.js`) idénticos a HEAD; sin campos nuevos en el documento; `CACHE` v77; 0 errores de consola | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |

## 9. Tests previstos

- **Nuevos**: `test/fluyo-018-18.test.cjs` (alcance contra HEAD, `CACHE`, ids, precache de `story-clock.js`; vm: reloj — pausa, reanudar, `seek` frente a ejecución continua, Trace intacto, determinismo; estados del transporte; páginas en el arnés de `renderTabs`; bloque Dirección), `test/fluyo-018-18-browser.cjs` (Chrome real: los 6 viewports de §8 + 430 y 812 × 375; interfaz clara/oscura; fixtures complejo, 12 nodos y 6 páginas; Viewer y Present; SW v77 sin red), `test/fluyo-018-18-mutations.cjs` (≥ 16: la pausa no congela; `seek` desfasado un momento; Present vuelve a avanzar con un toque; Viewer encaja antes de la banda; banda que crece; activa oculta bajo «＋»; ✕ de vuelta; `#rowFlow` de vuelta al grupo plegado; «Terminar» de vuelta; kernel tocado; `CACHE` sin subir…).
- **Adaptados con la misma intención**: `fluyo-013-browser`, `013-qa-browser` (toque), `014-browser`, `016-browser` («Terminar»), `018-14a-browser` (Viewer), `018-14b` (test, browser, mutations: «Terminar», grupos, `#scNow`), `018-17` (test, browser, mutations: alturas, `#scNow`, páginas «01 ▾»), los 9 de `.tab .x`/`.pgMore`, `share-browser` (pestañas del Viewer), pines de `CACHE` v76 → v77, `docs/index.html`.
- **Regresión**: `node --test test/*.test.cjs`, batería de Chrome, mutaciones de 018.12–018.17, `node --check`, `git diff --check`; fluyo-mcp `npm run check:kernel` (idéntico esperado).

## 10. Riesgos

- **Revisión rápida de decisiones recientes** (132, 136, 139, 146): el slice cambia detalles aprobados en 018.14b/018.17. Se justifica con medidas (H4, H5, §3.8), pero conviene aprobarlo explícitamente (D4, D5, D12).
- **Churn de tests**: ≈ 20 archivos se adaptan; el riesgo es perder intención. Cada adaptación se anota como en 018.17.
- **Comportamiento documentado que cambia**: el toque en Present (D7) y la ✕ de las pestañas (D11).
- **Parpadeo en pausa** (C1) y **rótulo sobre el lienzo** (C2): aceptados y medidos.
- **No verificable aquí**: teclado virtual y `dvh` en iOS/Android; giro real con barra del navegador. QA manual en dispositivo físico.
- **Kernel**: si D2 = (b), hay que sincronizar fluyo-mcp; con (a), no.

## 11. Compatibilidad

| Pieza | Impacto |
|---|---|
| Documento / formato `.fluyo.json`, `#d=` | ninguno (ningún campo nuevo; `flowDir` igual) |
| `model.js`, `config.js`, kernel | ninguno con D2 = (a) |
| MCP | ninguno |
| Historias existentes, Trace, Steps, `at` | ninguno (el reloj es presentación) |
| Shares ya emitidos | se ven igual y además se pueden pausar; el Viewer encaja bien |
| Undo/Redo | ninguno (pausar o saltar no son operaciones del documento) |
| Service Worker | `CACHE` v76 → v77 y un archivo nuevo en el precache (`js/story-clock.js`) |

## Archivos modificados (auditoría)

- `.ai/tasks/FLUYO-018.18.md` — creado (este documento). Ningún otro archivo del repositorio se creó ni modificó.

## Pruebas (auditoría)

- Exploración de solo lectura en Chrome real sobre el árbol del repo servido tal cual (§2). Scripts, resultados y capturas en el scratchpad de la sesión, fuera del repo.
- No se ejecutaron los tests del repo: no hay cambios de código.

## Handoff (auditoría)

### Estado actual

Auditoría y propuesta completas. Sin cambios de producto, sin commit, sin push, sin deploy.

### Próximo paso concreto

Revisar §7 (D1–D15). Con D1–D12 decididas, implementar la Fase A (C5, C6), después B (C1, C2) y C (C3, C4), cada una con su verificación en Chrome, y actualizar esta tarea con el handoff de implementación.

---

# FLUYO-018.18 — READY FOR REVIEW

- **Archivos**: solo `.ai/tasks/FLUYO-018.18.md` (nuevo). Sin cambios de código, CSS, HTML, tests ni assets. Sin commit, push ni deploy.
- **Base verificada**: `72bde0b` = `origin/main` (018.17 integrado), árbol limpio, `CACHE` v76.
- **Hallazgos principales**: no hay pausa ni navegación por momentos (y se pueden añadir sin tocar el kernel); tres mandos distintos para la misma Historia; la hoja móvil reproduciendo crece con el texto (lienzo 64/60 %); un toque en Present corta la Historia y cambia de página; el Viewer carga con el diagrama cortado (apaisado y 1280 × 720), no reencaja al girar, su banda salta durante la reproducción y su Present no reproduce Historias; con 6 páginas la activa puede quedar oculta (también bajo el «＋»); la ✕ «Cerrar página» elimina; el sentido de los puntos está plegado y fuera de la primera pantalla; el diálogo de evento tiene 40 de 43 controles < 44 px y en apaisado deja 261 px útiles; el apaisado de teléfono usa el layout de tableta (48 % de lienzo).
- **Propuesta**: transporte y rótulo del momento únicos para Editor, Present y Viewer (C1–C4), páginas (C5), sentido de los puntos en «Trazo» con su nombre real (C6); apaisado, diálogo y panel de escritorio dirigidos a 018.19–018.20 (C7–C9).
- **Decisiones que necesito**: D1–D12 para implementar 018.18 y D13–D15 como rumbo (§7).

---

## Implementación (12 de octubre de 2026)

Decisiones D1–D12 aprobadas por el responsable; D13–D15 quedan para 018.19/018.20. Antes de tocar código se releyó el contrato (§5–§8) y cada decisión quedó atada a un criterio de §8 y a un test (tabla «Decisión → test» más abajo). Sin tocar `model.js`, el formato, el kernel, el MCP, `flowDir` ni Undo/Redo.

### Causa e implementación, por decisión

| Decisión | Causa (auditoría) | Implementación |
|---|---|---|
| **D1–D3 Reloj** | H1–H3: sin pausa ni navegación; la proyección ya era función pura del reloj | `js/story-clock.js` (`FluyoStoryClock`, fuera del kernel): `now`, `pause`, `resume`, `momentTimes`, `momentIndex`, `prevTarget`, `nextTarget`, `seek(i)` = `FluyoStory.start(page, sc, ahora − at)` + un `tick`. Editor: `scClock`, `scNow()` en `scRun`/`scTick`/`buildScenarioRenderState`; `scPause`, `scResume`, `scTogglePause`, `scMomentNav`, `scSeekMoment`, `scSeekStep`, `scPrevMoment`, `scNextMoment`. «En pausa» = `running` con el reloj congelado (sin estado nuevo). La unidad es el momento |
| **D4 Momento sobre el lienzo** | H4: la hoja reproduciendo crecía con el texto (193/213 px; lienzo 64/60 %) | `#scNow` pasa de la hoja/columna a `#wrap`: una línea de alto fijo, material inverso (estado · momento · progreso). `scPlaceNow` (cada fotograma desde `editor-runtime.js`) lo pone arriba de la zona libre o al pie si el destino del momento (elementos y extremos de sus conexiones) queda debajo. `scRevealMoment`: al saltar, el lienzo enseña el momento entero (o su primer elemento si no cabe a zoom ≥ 0,6). Present conserva su encabezado (mismo componente visual) |
| **D5 Terminología** | H5, H10: tres salidas al acabar; «Terminar» y «Detener» para lo mismo | `#scReset` dice «■ Detener» en cualquier estado; `#scPause` Pausar/Reanudar (icono del sprite); `#scRun` Reproducir/Repetir; `#scPrev`/`#scNext` (iconos nuevos `i-step-back`/`i-step-fwd`). Hoja móvil: fila A = transporte + Ampliar, fila B = Detener · Volver a editar. Ampliar ya no detiene. Compartir bloqueado: «Pulsa «Detener» antes de compartir.» |
| **D6 Saltar por filas** | H2: tocar una fila reproduciendo no hacía nada | Reproduciendo (o en pausa, o terminada) toda la fila y el nombre del evento saltan a su momento (`.scSeekable`); nada se selecciona ni se edita. Espacio pausa/reanuda la Historia |
| **D7–D8 Present táctil** | H8–H12: un toque cambiaba de página y cortaba la Historia; 38 px; dos salidas; «▶» ambiguo | `interaction.js`: presentando, un toque no hace nada. `#presentBar` = `#psGroup` (anterior · Reproducir/Repetir · Pausar/Reanudar · siguiente · Detener) y `#prPages` (‹ n / N ›, chevrons) separados; una salida (`#prExit`, «Salir»; se retira `#psEdit`). 44 px con dedo; con el dedo el mando no se aparta. `fitViewPresent` reserva el alto real del mando. Espacio/Enter pausan y reanudan |
| **D9 Viewer** | H14–H19: encaje antes de la banda (cortado en apaisado y 1280 × 720), sin reencaje al girar, banda que crecía, cabecera de 2 filas, Present sin Historia | `viewer.js`: reloj compartido (`story.clock`, `storyTogglePause`, `storySeek`, `storyPrev/Next`); `#stNow` sobre el lienzo; banda de alto fijo solo con el transporte; `fitView` tras la banda, reservando el rótulo (y el mando en Present); `ResizeObserver` + `viewMoved` para reencajar al cambiar de tamaño; Present reproduce (el transporte se muda a `#prStory`); `#pgSelect` en ≤ 700 px; sin −/+ con dedo; sin «Hecho con Fluyo» en apaisado corto; `stOpen` oculto (el de la cabecera) |
| **D10–D11 Páginas** | §3.5: activa oculta (también bajo «＋»); ✕ «Cerrar página» que eliminaba; `prompt()` | `renderTabs`: sin ✕; ▾ de la activa con cualquier puntero (28 px ratón / 40 dedo); doble clic → renombrado en línea; `.pgSelect` («03 Nombre ▾») → `openPageMenu(i, anchor, {list:true})` con la lista, «＋ Nueva página», Renombrar… y Eliminar página; `revealActiveTab`; «＋» fijo también > 700 px; nombres con elipsis y `title` |
| **D12 Dirección** | §3.8: `#flowSel` plegado en «Flujo», fuera de la primera pantalla | `index.html`: «Trazo › Dirección» = Punta al inicio · Punta al final · Puntos en movimiento · Sentido de los puntos (segmentado «Hacia el destino / Hacia el origen / Ida y vuelta» sobre `#flowSel`, que sigue siendo el control nativo). «Color de puntos» al grupo plegado «Puntos». `syncFlowSeg` en `ui.js`; el Sentido solo se ofrece con los puntos en movimiento |

### Ajustes que salieron de la verificación (no cambian el diseño)

1. **El momento entero a la vista al saltar** (`scRevealMoment`): el primer browser test detectó que, en el 3.er momento (tres eventos simultáneos), el nodo «Comercio» quedaba fuera de la vista tras saltar, porque el seguimiento de 018.17 mira un solo paso.
2. **Una conexión cuenta con sus dos extremos** para decidir si el rótulo tapa el destino (antes solo su recorrido: podía tapar la mitad del nodo de llegada).
3. **Glifo y rótulo en un solo elemento en línea** (`.glyphText`) en Present y el Viewer: con el glifo pintado como máscara dentro de un botón flex, `innerText` devolvía «▶\nReproducir».
4. **«Dirección» se oculta para nodos** (`dirKicker` en `edgeRows`): el rótulo mantenía visible el grupo «Trazo» con un nodo seleccionado (panel 1,16 → 1,42 pantallas, lo detectó 018.14b).
5. **El ▾ de la pestaña activa a 28 px con ratón** (18 px: lo detectó 018.14b al hacerse visible con ratón).
6. **El transporte de la columna puede ocupar dos filas** en tableta con dedo (44 px): «Detener» se salía de la columna de 300 px (lo detectó 018.14b).

### Archivos modificados (implementación)

Producto (servido):

- `js/story-clock.js` — **nuevo**. Reloj de la Historia fuera del kernel (pausa, reanudar, momentos, saltar). Puro; no se sincroniza con fluyo-mcp.
- `js/editor-scenarios.js` — transporte (pausa, saltar, filas que saltan), rótulo del momento sobre el lienzo (`scPlaceNow`, `scRevealMoment`), «Detener» único.
- `js/editor-runtime.js` — coloca el rótulo en cada fotograma.
- `js/interaction.js` — toque en Present sin efecto; Espacio/Enter pausan; Escape detiene.
- `js/present-story.js` — fase «paused», mando agrupado, `fitViewPresent` con el alto real del mando.
- `js/ui.js` — pestañas sin ✕, selector de página móvil y lista en el menú, renombrado en línea, segmentado del sentido, cableado de Present.
- `js/editor-share.js` — texto «Pulsa «Detener» antes de compartir.».
- `js/viewer.js` — reloj compartido, rótulo sobre el lienzo, banda fija, encaje tras la banda y al girar, Present con Historia, selector de página.
- `index.html`, `s/index.html` — marcado del transporte, Present, rótulo, selector, «Trazo › Dirección», iconos nuevos del sprite, `story-clock.js`.
- `css/styles.css`, `css/share.css` — estilos de lo anterior.
- `sw.js` — `CACHE` v76 → v77; `./js/story-clock.js` en el precache.
- `docs/index.html` — ayuda: transporte de Historias, toque en Present, «Trazo › Dirección».

Documentación: `.ai/DECISIONS.md` (154–161), `.ai/ARCHITECTURE.md` (mapa de archivos + «Contar una Historia en cualquier superficie»), `CONTRIBUTING.md` (fila del mapa), esta tarea.

Tests nuevos: `test/fluyo-018-18.test.cjs`, `test/fluyo-018-18-browser.cjs`, `test/fluyo-018-18-mutations.cjs`.

Tests adaptados (misma intención; cada cambio comentado con «018.18»): pin de `CACHE` v76 → v77 en ~20 archivos; `viewer-harness` (carga `story-clock.js`); 013/013-qa (Salir, sin `psEdit`, el toque no navega, Espacio pausa); 014 (`stOpen` oculto → `btnOpen`); 016 («Detener»); 018-5 (renombrado en línea sin `prompt()`); 018-7a-f1, 018-7c, 018-7d, 018-8 (eliminar por «Eliminar página»); 018-12, 018-13 (sin ✕, selector móvil, ▾ con ratón); 018-14b (grupo «Puntos», Ampliar no detiene); 018-17 (alcance, «Detener», rejilla del transporte, selector). Mutaciones antiguas cuyo patrón ya no existía, reapuntadas al contrato equivalente: 018-5 E1/E2, 018-7c E12, 018-14b U6, 018-17 B12/B14 (todas detectadas).

**Sin tocar**: `js/model.js`, formato del documento, kernel (`config`, `safe-svg`, `model`, `scenario-engine`, `scenario-playback`, `story-playback`, `document-integrity`, `story-authoring`), MCP, `flowDir`, `update_connection`, `delete_page` del MCP, Undo/Redo, diálogo de evento.

### Métricas antes → después (Chrome real, mismo fixture)

| Medida | Antes (v76) | Después (v77) |
|---|---|---|
| Lienzo útil reproduciendo, móvil 390 × 844 / 375 × 812 | 64 % / 60 % | 72 % / 71 % |
| Alto de la hoja reproduciendo (4 momentos) | 193–213 px, variable | 125 px, constante |
| Toque en Present con Historia | página 0 → 1 y Historia cortada | sin efecto |
| Mando de Present con dedo | 38 px; dos salidas (83 × 38) | 44 px; una salida (90 × 44) |
| Mando de Present en vertical | 94 px, una fila mezclada | 106 px, dos filas agrupadas |
| Lienzo del Viewer 1440 / 768 / 390 / 375 / 844 × 390 | 77 / 80 / 71 / 70 / 45 % (39 con rótulo) | 84 / 85 / 83 / 82 / 71 % |
| Cabecera del Viewer 390 / 375 | 87 px, 2 filas | 50 px, 1 fila |
| Encaje al cargar (844 × 390, 812 × 375, 1280 × 720) | diagrama cortado | dentro |
| Banda del Viewer al reproducir | 123 → 148 px (salto) | 64 px fija |
| Reencaje al girar | no | sí (si el usuario no movió la vista) |
| Present del Viewer con Historia | solo «lista» | se reproduce, pausa y salta |
| «＋» visible con 6 páginas a 768 / 1024 / 844 | no | sí |
| Pestaña activa siempre visible | no | sí |
| ✕ que eliminaba | sí | no (eliminar solo desde el menú) |
| Panel con conexión seleccionada (pantallas) 1440 / 1280 / 768 | 1,16 / 1,49 / 1,38 | 1,08 / 1,40 / 1,24 |
| Panel con nodo seleccionado | — | sin cambio |
| Sentido de los puntos | plegado en «Flujo», fuera de la 1.ª pantalla | en «Trazo › Dirección», visible al activar los puntos |

### Pruebas

- **Unitarias** (`node --test test/*.test.cjs`): **1102 / 1102**. `test/fluyo-018-18.test.cjs` (13): alcance frente a `HEAD`, `story-clock.js` publicado/precacheado/fuera del kernel/puro, pausa/reanudar, saltar = recorrido continuo a 0/120/400 ms con la traza intacta, `momentIndex`/`prev`/`next`, transporte completo del editor en vm sin cambio de documento ni de Undo, salto desde la fila y desde el nombre, Viewer en vm desde un enlace real, páginas en vm, D12.
- `node --check` de todos los `js/*.js` y tests: OK. `git diff --check`: limpio. `npm run check:kernel` en fluyo-mcp: idéntico.

### Mutation testing

- `test/fluyo-018-18-mutations.cjs`: **24 / 24** estáticas (U1–U24) y **18 / 18** en Chrome (B1–B18), con la copia sin mutar en verde antes de mutar. Supervivientes intermedios analizados y cerrados reforzando el test, no la mutación: U10 (salto desde el nombre del evento) y U16 (reencaje síncrono del Viewer).
- Mutaciones de slices anteriores, todas detectadas: 018.4 18/18, 018.5 44/44, 018.7a 62, 018.7c 45, 018.7d 12, 018.8 21, 018.12 8/8, 018.13 6/6, 018.14a 10/10, 018.14b 10/10, 018.15 12/12, 018.16 9/9, 018.17 20/20 estáticas + B12/B14 en Chrome.

### Chrome real

- `test/fluyo-018-18-browser.cjs`: **431 ✔ · 0 ✘** en 390 × 844, 375 × 812, 768 × 1024, 844 × 390, 1440 × 900, 1280 × 720 (y 812 × 375): editor (transporte, rótulo sin tapar el destino ni los mandos, hoja constante, saltos), Present (toque sin efecto, 44 px, una salida, grupos separados), Viewer (encaje, giro, banda fija, Present con Historia), páginas (selector, «＋», activa visible, sin ✕, sin `prompt()`), Dirección, y Service Worker sin red con v77.
- Batería anterior en verde: 013, 013-qa, 014 (13), 015 (15), 015-qa (13), 016 (17), 017-3 (8), 018-3 (27), 018-4 (76), 018-5 (22), 018-7a (67), 018-7c (29), 018-7d (12), 018-8 (20), 018-9 (36), 018-10 (18), 018-12 (268), 018-13 (251), 018-14a (230), 018-14b (532), 018-15 (576), 018-16 (720), 018-17 (523), qa-share-hash, share-browser, share-realistic.

### Regresiones

- Ninguna atribuible a 018.18.
- `fluyo-011-browser`: las **mismas 4 fallas** en `HEAD` (exportado limpio) y en el árbol de trabajo — preexistentes, fuera de este slice.
- `fluyo-018-16-browser`: en la pasada completa, un `net::ERR_NO_BUFFER_SPACE` del entorno (sockets agotados); repetido solo, 720 ✔ · 0 ✘.
- `scenario-qa` y `share-post-qa`: no ejecutados (dependen de un entorno que esta máquina no ofrece); su terreno lo cubren 016/018-17 y share-browser/share-realistic.

### CACHE

`fluyo-static-v76` → `fluyo-static-v77`: cambian archivos servidos (HTML, CSS, JS) y entra uno nuevo (`./js/story-clock.js`) en el precache. Verificado en Chrome: la v77 se instala, borra la v76 y el transporte funciona sin red (B18 lo vigila).

### QA manual (capturas por paso, Chrome real)

- [x] **Escritorio 1440 × 900**: Editar → Historia → Reproducir → Pausar → Saltar (×2) → Reanudar → Detener → Editar. Documento y pila de Undo idénticos antes y después; 0 errores.
- [x] **Móvil 390 × 844 (dedo)**: Historia → Ampliar → tocar el 3.er momento (salta, nada se edita) → Reproducir → tocar el lienzo (sigue reproduciendo) → Pausar → Saltar → Reanudar → Detener → Volver a editar. Documento y Undo intactos; 0 errores.
- [x] **Viewer 1440 × 900 y 390 × 844**: enlace de Historia → Reproducir → Pausar → Saltar (×2) → Reanudar → Detener. Rótulo, progreso y banda coherentes; 0 errores.
- [x] Present con dedo: el toque no navega ni detiene; páginas e Historia en grupos distintos; una sola salida.
- [x] Páginas: selector móvil con la activa, «＋ Nueva página» dentro; escritorio sin ✕, «Eliminar página» en el menú, doble clic renombra en línea.
- [x] Trazo › Dirección: los tres sentidos escriben `normal` / `reverse` / `alternate`; el Sentido aparece solo con los puntos en movimiento.

### Desviaciones respecto al plan

1. **Mando de Present en vertical en dos filas** (Historia arriba; páginas + Salir abajo; ≤ 480 px las etiquetas de página se ocultan): en una fila no caben 8 controles de 44 px. 106 px frente a 94, pero agrupado y legible.
2. **≤ 480 px el estado del rótulo del momento es un punto** (el texto «Reproduciendo/En pausa» queda para lectores de pantalla) para que el rótulo quepa en una línea.
3. **`stOpen` oculto en la banda del Viewer**: «Abrir en Fluyo» ya está en la cabecera; la banda queda solo para el transporte (alto fijo).
4. **En móvil «Sentido de los puntos» exige abrir «Trazo»**: se respeta el acordeón de una sección abierta (decisión 136); en escritorio está en la primera pantalla.
5. **Ajustes de verificación** (sección anterior): `scRevealMoment`, extremos de conexión en el cálculo del rótulo, `.glyphText`, `dirKicker` oculto para nodos, ▾ a 28 px, transporte que puede ocupar dos filas en tableta.
6. **«Ampliar» ya no detiene** una Historia terminada (consecuencia de D5: «Detener» es la única salida del transporte).
7. **Tests de slices anteriores adaptados** porque las decisiones aprobadas cambian su contrato (✕, `prompt()`, «Terminar», toque en Present, `stOpen`); ninguna aserción se retiró sin sustituirla por la del nuevo contrato.
8. D13–D15 (apaisado de teléfono, diálogo de evento, panel de escritorio): **no tocadas**.

Ninguna condición de parada se activó: sin cambios en `model.js`, formato, kernel, MCP, reescritura de entrada, arquitectura nueva de Present ni segundo motor de reproducción.

## Handoff (implementación)

### Estado actual

D1–D12 implementadas y verificadas en el árbol de trabajo sobre `72bde0b`. **Sin commit, sin push, sin deploy.** `CACHE` v77.

### Próximo paso concreto

Revisión del responsable y commit (63 rutas: 58 modificadas + 5 nuevas). Después, 018.19/018.20 con D13–D15.

---

# FLUYO-018.18 — READY FOR COMMIT

- D1–D12 implementadas; un solo reloj (`js/story-clock.js`) para Editor, Present y Viewer; sin tocar `model.js`, formato, kernel, MCP, `flowDir` ni Undo/Redo.
- Unitarias 1102/1102; Chrome 018.18 431 ✔ · 0 ✘ y batería anterior en verde; mutaciones 24/24 + 18/18 y anteriores detectadas; `CACHE` v76 → v77.
- Sin commit, push ni deploy.
