# FLUYO-018.30 — Viewer en el teléfono: la cámara sigue el momento de la Historia

Estado: READY FOR REVIEW/COMMIT (sin commit, sin push, sin deploy)
Owner/agente actual: —

> Base: `main` en `87a9d76` (fluyo.space v103, R1 + G1 de 018.29 cerrados). Deuda abierta desde 018.18 §6 («seguir el destino activo en
> el Viewer vertical») y confirmada en la auditoría post-slices de 018.18 (zoom 0,33–0,45, etiquetas de ≈ 4–6 px).

## Objetivo

Que quien abre una Historia compartida en un teléfono en vertical vea **dónde** y **qué** pasa en cada momento: el destino activo legible
(etiquetas ≥ 9 px), entero en la zona libre del lienzo, sin romper Playback, Present, Viewer, seek, pausa, dependencias ni mensajes.

## Alcance

### Incluye

- `js/viewer-viewport.js`: tres funciones puras nuevas (`viewportFollowZoom`, `viewportFrameBox`, `lerpViewport`) y dos constantes
  (`FOLLOW_MIN_ZOOM` 0,6, `FOLLOW_MAX_ZOOM` 1).
- `js/viewer.js`: la cámara de la Historia (estado `followOn`/`followApplied`/`camera`, `storyStop`, `viewerFreeRect`, `followBoxes`,
  `fitTarget`, `cameraTo`/`cameraStep`, `takeCamera`, `followZoomNow`/`followFrame`/`storyFollow`, `viewerReframe`) y su cableado.
- `sw.js`: CACHE v104.

### No incluye (intacto, verificado por test de alcance)

- Modelo de datos, formato `.fluyo.json`, kernel (motor, playback, `story-playback.js`, `story-clock.js`), render, geometría, ruta de
  Flujo, enlace/URL corta, HTML y CSS del Viewer, editor y Present del editor. **MCP: nada** (el Viewer no es kernel).

## Auditoría (antes de implementar, sobre `87a9d76` real, Chrome)

Sonda en Chrome real (Playwright, SW bloqueado), Viewer abierto desde `/s/#d=…` creado por el editor (`createShareUrl`, Historia
primero). Cuatro documentos: cliente-kafka-comercio (simple, sin ruta), complejo de 017.1 (sin ruta, un momento de 5 elementos), B9 de
FASE 6 (ruta de Flujo + dependencia de llegada), RAG + MCP (10 elementos, 11 momentos, dependencias de llegada). Tamaño de etiqueta =
el que pinta `fillText` EN PANTALLA (espía del lienzo), no el del documento.

| Viewport | simple | complejo | B9 (ruta) | RAG |
|---|---|---|---|---|
| 390×844 | zoom 0,43 · 5,6–7,3 px | 0,45 · 5,9–7,7 px | 0,34 · 4,8 px | 0,27 · **2,8–3,8 px** |
| 375×812 | 0,42 · 5,4–7,1 px | 0,44 · 5,7–7,4 px | 0,33 · 4,6 px | 0,26 · **2,7–3,7 px** |
| 844×390 | 0,94 · 15,9 px | 0,62 · 10,5 px | 0,42 · 6,0 px | 0,36 · 3,7–5,0 px |
| 1440×900 | 1,60 · 27 px | 1,67 · 28 px | 1,25 · 18 px | 1,01 · 10,5–14 px |

Respuestas a las cinco preguntas:

1. **Cómo se calcula el zoom.** `fitView()` (viewer.js) → `fitViewportToBounds(view, getBounds(), ancho, alto − rótulo − mando)`: el
   diagrama ENTERO en el lienzo, tope 2,5, sin suelo. En vertical el ancho manda: un diagrama de 1230 u en 390 px sale a 0,27.
2. **Cómo se determina el destino activo.** No se determinaba para la cámara: solo `storyPlace()` lo calculaba (momento de
   `storyNav().index`; nodos de sus pasos y extremos/trazado de sus conexiones) para decidir si el rótulo va arriba o al pie.
3. **Cuándo se recalcula el encuadre.** Solo al abrir, al cambiar de página, al entrar/salir de Present, al pulsar Encajar y, mientras
   nadie movió la vista, al cambiar el tamaño del lienzo (ResizeObserver: girar, barra del navegador). **Nunca** al reproducir, pausar,
   saltar ni al cambiar de momento.
4. **Por qué el destino queda tan pequeño.** Porque el único encuadre es «todo el diagrama», que en vertical está limitado por el ancho
   (390 px) mientras sobra alto (≈ 60 % del lienzo vacío por encima y por debajo, ver capturas), y no hay ninguna regla de legibilidad
   (el editor sí la tiene: `REVEAL_MIN_ZOOM` 0,6, decisión 148). El destino siempre está «a la vista», pero a 3–7 px no se lee.
5. **Qué debería hacer FLUYO.** Lo mismo que el editor en la hoja móvil (decisión 148), adaptado a reproducir: si el diagrama entero no se
   lee, **no se encoge para meterlo todo**; se sigue el momento en curso a un zoom legible (≥ 0,6), enseñándolo entero bajo el rótulo,
   con una transición corta, moviendo la cámara solo al cambiar de momento y solo si el momento no se ve ya; y quien mira puede tomar
   la cámara (arrastrar, pellizcar) y devolvérsela (⏭/⏮, Reproducir). Donde el diagrama entero se lee (escritorio, tableta, casi todo
   apaisado) nada cambia.

No hacía falta decisión de producto: el pedido autoriza no conservar todo el diagrama a la vista y la regla de legibilidad ya existe en
el editor (decisión 148). Los parámetros (0,6 / 1 / 450 ms) quedan como decisión técnica 259 y son fáciles de ajustar.

## Contrato final (decisión 259)

- **Cuándo se sigue.** Solo reproduciendo una Historia (también en pausa y terminada) y solo si el diagrama entero, encajado en la zona
  libre, sale por debajo de **0,6** (`viewportFollowZoom` devuelve `null` si no). Es una regla de legibilidad, no de tipo de pantalla:
  RAG en una tableta en vertical (0,54) se sigue; el documento simple en un teléfono apaisado (0,94) no.
- **Zoom.** Uno para toda la Historia: el mayor al que cabe, en la zona libre con 16 px de margen, el momento más grande; con suelo
  **0,6** (decisión 148) y techo **1** (nunca más grande que el autor lo dibujó). Entre momentos la cámara solo se desplaza.
- **Momento.** `followBoxes()`: por momento (orden de `FluyoStoryClock.momentTimes`), la caja de sus elementos, los dos extremos y el
  trazado de sus conexiones, con aire para el globo (40 u arriba) y la etiqueta de icono/imagen (24 u abajo). El momento en curso es
  `storyNav().index` (instante VISIBLE: respeta las dependencias de llegada); antes del primero, el primero.
- **Zona libre.** `viewerFreeRect()`: el lienzo menos el rótulo de la Historia (su alto + 20) y, presentando, el mando (su alto + 28). Es
  la misma que usa `fitView` (que ahora aplica `fitTarget()`), así que «encajar» y «seguir» hablan del mismo espacio.
- **Cuándo se mueve.** En el fotograma en que cambia el momento (`storyFollow`, nunca a cada fotograma), al saltar (⏭/⏮) y al cambiar el
  tamaño del lienzo; y **solo si** el momento no se ve ya entero a ese zoom (`viewportFrameBox` devuelve `null`). Si el momento no cabe
  ni a 0,6, se centra lo más posible sin dejar fuera su primer elemento (entero).
- **Transición.** 450 ms, ease-in-out, el punto bajo el centro en línea recta y el zoom geométrico (`lerpViewport`). Con
  `prefers-reduced-motion: reduce`, salta. Girar el teléfono reencuadra sin transición.
- **Quien mira manda.** Arrastrar, pellizcar, la rueda, −/+ y **Encajar** (el diagrama entero, también reproduciendo) apagan el
  seguimiento (`takeCamera`). **Reproducir/Repetir** y **⏭/⏮** lo encienden otra vez. Tocar sin mover no cuenta.
- **Detener** devuelve, con transición, el encuadre del diagrama entero si la cámara de la Historia llegó a acercarse (aunque luego
  quien mira la moviera): es el estado de antes de reproducir. Tras Encajar o donde no se siguió, no toca la vista.
- **Terminada**, la vista se queda donde está (el último momento). **Present** del Viewer: se sigue igual, sobre el mando; al entrar y al
  salir, el diagrama entero (no hereda el acercamiento).
- Sin cambios: pausa (la cámara quieta), G1 (saltar en pausa revela el momento: `revealAt`), el cursor en `at`, el rótulo arriba/al pie
  (`storyPlace`), la ruta de Flujo, las dependencias, Steps, Trace y documento.

## Resultado (Chrome real, mismo método que la auditoría)

| Viewport | simple | complejo | B9 (ruta) | RAG |
|---|---|---|---|---|
| 390×844 | **0,68 · 11,6 px** | **0,60 · 10,2 px** | **0,86 · 12,3 px** | **0,93 · 9,7–13,1 px** |
| 375×812 | **0,66 · 11,1 px** | **0,60 · 10,2 px** | **0,83 · 11,7 px** | **0,89 · 9,3–12,5 px** |
| 844×390 | sin seguir (0,94) | sin seguir (0,62) | **0,68 · 9,6 px** | **0,60 · 6,2–8,4 px** |
| 1440×900 | igual que antes | igual | igual | igual |

En el complejo, un momento (3 envíos desde Kafka hasta Cliente, Comercio y Banco) no cabe ni a 0,6 en 390 px: se ven Kafka, Comercio y
Banco enteros y Cliente queda fuera por la izquierda (el primer elemento del momento siempre entero). En apaisado, RAG queda en el suelo
(0,6): 6,2 px en sus etiquetas más pequeñas (fs 10 del autor); es el límite aceptado del editor.

## Diff (código)

- `js/viewer-viewport.js` (+43): `FOLLOW_MIN_ZOOM`, `FOLLOW_MAX_ZOOM`, `viewportFollowZoom`, `viewportFrameBox`, `lerpViewport`. Puras,
  sin DOM (test de alcance).
- `js/viewer.js` (+≈ 130): estado de la cámara; `renderViewerFrame` llama `storyFollow()` y `cameraStep()` antes de pintar;
  `storyPlay`/`storySeek` encienden el seguimiento; `storyReset` lo apaga; `storyStop` (botón ■) vuelve al diagrama entero; `fitView`
  aplica `fitTarget()` (misma zona libre) y cancela la transición; rueda, arrastre, pellizco y −/+ llaman `takeCamera()`; Encajar
  apaga el seguimiento; el ResizeObserver llama `viewerReframe()`; `enterPresent` no hereda el acercamiento; `__viewer.follow`
  (inspección para tests).
- `sw.js`: CACHE v103 → v104.

## Pruebas

### vm — `node --test test/fluyo-018-30.test.cjs` → 13/13

Puras (suelo, techo, null donde se lee entero, mayor zoom al que cabe; no mover si ya se ve; foco entero; extremos y zoom geométrico de
la transición) y el `viewer.js` REAL en `test/viewer-harness.cjs` a 390×685 y 1440×749 con RAG, B9 y el complejo: acercar al
reproducir, mismo zoom en todos los momentos, cada momento que cabe entero en la zona libre, saltar en pausa (cursor en `at`,
`revealAt`), rueda/arrastre/Encajar/−/+ toman la cámara, ⏭/⏮ la devuelven, Detener, girar a apaisado y a tableta, Present, movimiento
reducido, escritorio intacto, Steps/dependencias/Trace intactos; alcance frente a `87a9d76` y `undo030` exacto.

### Chrome real — `node test/fluyo-018-30-browser.cjs` → **402 ✔ / 0 ✘**

Viewer abierto desde el enlace compartido (`/s/#d=…` creado por el editor) en 390×844, 375×812, 844×390, 812×375, 768×1024, 1440×900 y
1280×720, con los cuatro documentos (con y sin ruta, con dependencias de llegada). Por caso: seguir o no según el zoom del diagrama
entero (< 0,6), zoom 0,6–1, etiquetas del destino ≥ 9 px en vertical y ≥ 6 px en apaisado (espía de `fillText`), el momento en la zona
libre y sin el rótulo encima; **reproducción completa** hasta «terminada» (390, 844, 1440: cada cambio de momento a la vista, la cámara
nunca se mueve dentro de un momento, terminada se queda quieta, Repetir vuelve al primero); **pausa** (cámara quieta 700 ms);
**⏭ en pausa por todos los momentos** (a la vista, cursor exactamente en `at`, `revealAt` de G1) y **⏮**; **arrastrar** toma la cámara
y reanudar la respeta, **⏭** la devuelve; **Detener** = encuadre de al abrir; Steps, dependencias y Trace intactos; sin errores de
consola. Además: **girar** 390×844 → 844×390 → 390×844 reproduciendo (RAG y B9), **Present del Viewer** en 844×390 (el momento sobre el
mando; al salir, el diagrama entero), **prefers-reduced-motion** (salta) y el **editor en 390** (tocar una fila de la Historia la
selecciona y reproducir sigue funcionando; el editor no cambia en esta tarea). Escritorio y tableta con documentos que se leen enteros:
la vista no cambia ni un píxel en toda la Historia.

### Mutaciones — `node test/fluyo-018-30-mutations.cjs` → U 12/12 y B 8/8 detectadas

Suelo 0,2, sin seguimiento, reencuadre a cada fotograma, la rueda no toma la cámara, Detener deja la vista acercada, ⏭/⏮ no la
devuelven, la zona libre ignora el rótulo (solo lo delata el apaisado: en vertical sobra alto), seguir también en escritorio, sin
transición, movimiento reducido ignorado, girar no reencuadra, Present hereda el acercamiento, el foco se pierde, CACHE sin subir.

### Regresión

- vm completo en clones git (HEAD vs HEAD + este diff con commit simulado): HEAD 1600 tests / 81 fallos; con 018.30 1613 / 81, **mismo
  conjunto de fallos** (los 81 son previos y conocidos: harnesses vm sin `story-clock.js`, 018-25 P1, 019-2 alcance de model.js…).
- Tests antiguos tocados (mantenimiento, como en 018.29): pines de CACHE v103 → v104; `fluyo-018-18.test.cjs` (la reserva del rótulo
  vive ahora en `fitTarget`/`viewerFreeRect`); `fluyo-scenarios-semantics-5.test.cjs` (stubs de `storyFollow`/`cameraStep` en su
  extracción de funciones); `undo030` encadenado bajo `undoMsg` (`fluyo-step-message-001-undo.cjs`) y en los alcances de 018.29 y
  STEP-MESSAGE; `ONLY030` (solo `viewer-viewport.js`) en semantics-1/2/3 y step-reverse-002.
- Chrome, suites que abren el Viewer, clon de HEAD frente a este árbol, mismos números: 018-18 428, 018-21 37, 018-29 397,
  scenarios-semantics-5 86 y -6 53, step-message-001 86, step-reverse-003 68, 019-2 86, 018-14a 231, 015 15, 016 17, 019-5 69 ✔ (0 ✘).
  `fluyo-014-browser` fallaba en «Responsive» 390×844: comprobaba que el diagrama ENTERO siguiera a la vista reproduciendo (contrato
  anterior; el de ahora lo cambia a propósito). Actualizado: si la cámara sigue, lo que debe verse entero es el momento en curso; si
  no, el diagrama entero como antes. Pasa entero (incluida la actualización del SW a v104).

## Pendientes / riesgos

- **Colisión de numeración con FLUYO-PRODUCT-NARRATION-001** (en curso en otro worktree, `fluyo-narration`): también usa CACHE v104 y la
  decisión 258. Esta tarea usa la decisión **259**. Quien se publique segundo debe subir CACHE (v105) y sus pines.
- La cámara se mueve mucho en Historias de muchos momentos cortos que recorren el diagrama (RAG: ≈ 450 ms de cada ≈ 650 ms). Si
  molesta, bajar `CAMERA_MS` o mover solo cuando el momento salga de la zona libre con más margen; es un parámetro.
- `FOLLOW_MAX_ZOOM` 1 deja el documento simple a 0,68 en 390 px (no a 1) porque su momento más ancho lo limita: correcto por diseño
  (un zoom para toda la Historia). La alternativa —zoom por momento— daría más tamaño pero «respiraría» entre momentos.
- El editor no cambia: su seguimiento en la hoja móvil (decisión 148, `scFollowActive`) ya existía; no se ha unificado con este.

## Handoff

- **Hecho**: auditoría (arriba) e implementación completa; READY FOR REVIEW/COMMIT. Sin commit, push ni deploy.
- **Archivos servidos**: `js/viewer.js`, `js/viewer-viewport.js`, `sw.js` (v104).
- **Docs**: esta tarea; `.ai/DECISIONS.md` (decisión 259).
- **Tests nuevos**: `test/fluyo-018-30.test.cjs`, `test/fluyo-018-30-browser.cjs`, `test/fluyo-018-30-mutations.cjs`,
  `test/fluyo-018-30-undo.cjs` (undo030; las piezas salen del diff: si cambia el código de esta tarea hay que regenerarlas).
- **Tests tocados**: pines de CACHE (v103 → v104), `fluyo-018-18.test.cjs`, `fluyo-scenarios-semantics-5.test.cjs`,
  `fluyo-014-browser.cjs`, `fluyo-step-message-001-undo.cjs`, `fluyo-step-message-001.test.cjs`, `fluyo-018-29.test.cjs`,
  `fluyo-scenarios-semantics-1/2/3.test.cjs`, `fluyo-step-reverse-002.test.cjs` (ver Regresión).
- **MCP**: nada (el Viewer no es kernel; `viewer-viewport.js` no se sincroniza).
- **Próximo paso**: revisión del PO en un teléfono real (abrir un enlace compartido de una Historia en vertical y reproducir); si el
  ritmo de la cámara gusta, commit (`feat(viewer): …`) y publicación. Antes de publicar, resolver el orden con PRODUCT-NARRATION-001
  (CACHE v104 / v105).
