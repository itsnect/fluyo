# FLUYO-019.4b — Piel «construido» en el editor

**Estado: READY FOR COMMIT** (20-10-2026). Sin commit, sin push y sin deploy.

- Base: `main` `eff5129` (Semantic Scenarios FASE 1 + FASE 2 integrada, CACHE v94).
- CACHE: v95.
- Decisiones: 226–229 (la 202 queda anotada como revisada por la 226).
- MCP: sin cambios.

> **Nota sobre la fuente.** Al empezar no había un `.ai/tasks/FLUYO-019.4b.md` en el repositorio ni en ninguna rama. El contrato se ha tomado de tres fuentes y se fija aquí:
> - la auditoría `.ai/tasks/FLUYO-019.4.md` (§9 «019.4b», D1–D8 y F5–F9; sin seguimiento en git);
> - las decisiones 209–213;
> - las decisiones de PO P1–P5 y la batería Q1–Q11 de la sesión.
>
> N1, N2 y N3 se definen abajo a partir de esas fuentes.

## Objetivo

«Lo que diseñas es lo que presentas.» Con `settings.skin = "built"`, el lienzo del editor pinta la misma piel que Present, con el mismo `render()` y las capas de la 212 y el aterrizaje de la 213. La selección y la interacción funcionan sobre lo que se ve. Con la piel apagada, el editor es exactamente el de antes.

No es edición 3D: posiciones, rutas, anclas y cajas siguen siendo 2D.

## Decisiones de PO (aplicadas tal cual)

| | Decisión | Implementación |
|---|---|---|
| **P1** Activación | (a) el editor sigue a `settings.skin`; `#skinSel` controla el aspecto; sin botón nuevo | `editorSkin()` / `editorSkinOn()` en `editor-runtime.js`; `#skinSel` solo cambia su `title`. Decisión 226 |
| **P2** Solapes | (a) el acierto sigue el orden de pintado de las hojas con piel; «Traer al frente / Enviar atrás» no cambia lo que se ve entre hojas con piel (aceptado) | `nodePaintLayers` es la lista que pinta `render()` y la que recorren al revés `hitLeafNode`, `hitContainerNode` y `hitSideArrowHost`. Decisión 227 |
| **P3** Caras | (a) área = caja lógica + 4 ∪ `skinExtent`; tapa y lateral son de la hoja; la conexión pierde prioridad donde una cara la tapa | `nodeBoxHit` + `nodeSkinExtent`. Decisión 227 |
| **P4** Marco | (a) marco en la caja lógica ±6, pintado en la pasada final; los tiradores no siguen a la envolvente | `drawNodeSelection` en `drawEditorMarks`. Decisión 228 |
| **P5** Secuencia | (a) 019.4b ahora: después de Semantic Scenarios FASE 1+2 y antes de FASE 4. N3 queda para FASE 4 | Sin cambios en Semantic Scenarios |

## Relación con otras piezas

### 019.4a y D6

- **019.4a (decisión 213)**: el aterrizaje no cambia. El editor usa los puntos pintados (`edgePaintedPoints` = `skinEdgeLanding(edgePoints(e), destino)`, la misma llamada que `drawEdge`) para dibujar los tiradores y para acertar el extremo.
- **D6 (decisión 212)**: las capas no cambian. `render()` pinta `nodePaintLayers(P().nodes, rs.skinOn)`, que es el `containmentPaintOrder(…, skinPaintOrder)` de siempre. Ahora lo comparte el acierto. La lógica de D6 (`containmentPaintOrder`, `isContainerNode`) no se toca; sus tablas siguen pasando.

### Semantic Scenarios

Los contratos no cambian:
- Connection / FLOWS_TO / REQUIRES;
- AVAILABLE / UNAVAILABLE / NO_PATH;
- `flow-semantics.js` y el modelo de Historia.

Las marcas de semántica (`edgeSemanticMarks`) se pintan en `drawEdge` como antes. Con la piel en el editor se ven igual que ya se veían en Present.

La autoría de Historias hereda el contrato de acierto de Q6: usa `hitLeafNode`/`hitNode`.

## Capas del fotograma con la piel

```
fondo · rejilla
① contenedores (D6)                         ② conexiones (línea, puntas, marcas de semántica, anillo, flujo, etiqueta,
③ pelota única                                  funda, resaltado de Historia, tokens)
④ hojas (capas de la piel, rótulo, overlays de Scenario, resaltado de Historia)
⑤ cues de Scenario (símbolo y mensaje)
⑥ MARCAS DEL EDITOR — drawEditorMarks: marco ±6 y esquinas de los nodos seleccionados; tiradores de la conexión seleccionada
   sobre su línea pintada                                                                   ← nuevo (F6)
⑦ puerto de conectar · origen de «Conectar» · vista previa de soltar · goma · marco rectangular · pista de lienzo vacío
```

En plano, ⑥ no existe: `drawNodeSelection` y `drawEdgeHandles` se llaman donde siempre, dentro de `drawNode`/`drawEdge`. El lienzo plano es el mismo operación a operación.

## Contrato de acierto (con la piel; en plano, el de siempre)

1. Instrumentos del objeto seleccionado (orden de la 144):
   - esquinas → extremos → codos → tramos.
   - Los extremos se aciertan en el ancla lógica **y** en la punta pintada (N1/N2).
2. Puerto de conectar, en `connectPortPoint(n, side, zoom, connectPortLift(n, side))`. Solo con ratón.
3. `hitTarget`:
   - Primero la hoja: la de encima según el pintado, con área = caja + 4 ∪ `skinExtent`.
   - Después la conexión, con la geometría lógica y la tolerancia de siempre.
   - Por último el contenedor: el último pintado.
4. Destinos que solo pueden ser nodo, con `hitNode` = hoja ‖ contenedor: soltar, «Conectar», modo Flecha y eventos de elemento de Historia.

La franja + 4 y las esquinas vacías de la envolvente rectangular son tolerancia, igual que en plano. En esas franjas puede acertarse un nodo que no pinta ese punto.

## Hallazgos resueltos

| # | Hallazgo (019.4) | Resolución |
|---|---|---|
| **F5** | El orden de acierto y el de pintado divergían (52,1 % en solapes) | P2: el acierto recorre `nodePaintLayers` al revés. Q7: 0 divergencias en los puntos donde se ve un nodo |
| **F6** | Las marcas iban dentro de `drawNode`/`drawEdge` y las tapaban caras y hojas posteriores (esquina NE de un contenedor bajo la tapa de un hijo, extremo de salida bajo la tapa de su origen) | Pasada final `drawEditorMarks`. Q4: 29/29 marcas visibles en crema y en oscuro |
| **F7** | El puerto norte/este pisaba la tapa (acierto desde zoom ≥ 1; centro desde > 2,25) | `connectPortLift` = lo que sobresale la silueta por ese lado (8 u en n/e de un bloque; la peana de un icono por el este; 0 en el resto). Dibujo y acierto, el mismo punto. Arrastrar desde la tapa a zoom 2,5 mueve la hoja |
| **F8** | El 48 % de tapa y lateral era «muerto», y un toque en el lateral seleccionaba la conexión de debajo | P3. Q6: rejillas vm a 0,375 / 1 / 2,5 con ratón y con dedo, y clics y toques reales |
| **F9** | El textarea escribía en Georgia 400; al confirmar, el rótulo saltaba a Plex Mono 500 con otro tamaño y otros saltos | `nodeLabelVoice` (la voz de `drawNode`) en `editBoxGeometry`, con la misma medida de `labelLayout`. Mismo `font` y misma línea base que el lienzo. Q8: 0 px de salto de línea base |

## N1, N2 y N3

- **N1 — el tirador del destino era inalcanzable con un icono por el este.** Con D4(a), el tirador se pinta en la punta aterrizada. Con un icono por el este, esa punta queda a más del radio de ratón (9 u) del ancla lógica; en el corpus de 019.4a, 16 u. Su centro no se podía acertar. Ahora `hitEdgeEnd` acierta también la punta pintada (`edgePaintedPoints`).
- **N2 — en los bloques el centro cabía, pero no el círculo.** El aterrizaje es de 8 u, frente a un radio de 9 u. El círculo pintado (4,5 px) se salía del radio lógico. Con la misma unión, se acierta todo el círculo a 0,375, 1 y 2,5, con ratón y con dedo. Los codos y las barras ya estaban sobre la línea que se ve: el aterrizaje solo mueve el último vértice sobre su tramo, que nunca lleva barra.
- **N3 — el anillo de Requisito se parece al anillo de salida de la piel.** El anillo de Requisito (`edgeSemanticMarks`) queda junto al anillo de salida (`skinEdgePort`) y se confunden. Ya pasaba en Present. **Fuera de 4b**: es del pintado de Semantic Scenarios con la piel (FASE 4, P5).

## Implementación

| Archivo | Cambio |
|---|---|
| `js/editor-runtime.js` | `editorSkin()`, `editorSkinOn()` (predicado único); `viewport.skin = editorSkin()` |
| `js/render.js` | Contratos compartidos (`nodePaintLayers`, `edgePaintedPoints`, `nodeSkinExtent`, `nodeLabelVoice`, `connectPortLift`). Se extraen `drawNodeSelection`/`drawEdgeHandles`, que en plano se llaman en su sitio. Se añade `drawEditorMarks` (pasada final con la piel). `paintLayers` llama a `nodePaintLayers`. `drawConnectPort` usa el `lift`. `drawNode` usa `nodeLabelVoice` |
| `js/interaction.js` | `skinHitOn()` (pregunta a `editorSkinOn`). `nodeBoxHit` con caras. `hitLeafNode`, `hitContainerNode` y `hitSideArrowHost` en el orden de pintado. `hitSideArrow` con `lift`. `hitEdgeEnd` con la punta pintada. `editBoxGeometry` con la voz. Firma del textarea con la piel |
| `js/geometry.js` | `connectPortPoint(n, side, zoom, lift=0)` |
| `js/state.js`, `index.html` | Comentarios y el `title` de `#skinSel` («Aspecto del documento: lienzo, Present, exportación y Viewer») |
| `sw.js` | CACHE v94 → **v95**: el valor de `main` es v94, y v95 no existe en ninguna rama ni archivo |

No cambian:
- `skin.js` y `export.js`;
- `model.js` (kernel y formato) y `ui.js`;
- `selection.js` y `editor-scenarios.js`;
- `flow-semantics.js`, el Viewer, Share y CSS;
- fluyo-mcp.

## Pruebas

### Nuevas

- **`test/fluyo-019-4b.test.cjs`** (vm, 12/12, unos 40 s).
  - Predicado único y umbral (0,37 / 0,375 / 0,38).
  - **Q1 en vm**: registro completo de operaciones de `render()`, igual que en `eff5129`. Cubre nodo, conexión y multiselección, puerto, «Conectar», marco y «built» a 0,3 / 0,37, en crema y oscuro; más de 20 000 operaciones. Rejilla de acierto y textarea idénticos, con ratón y con dedo.
  - **P3**: área = caja + 4 ∪ `skinExtent`.
  - **Q6**: rejilla de tapa y lateral, en 3 zooms × ratón/dedo.
  - **P2/Q7**: las hojas y los contenedores son los de encima según el pintado. Hay casos donde el orden del documento elegiría otra hoja, y donde el contenedor de menor área no es el pintado encima. Incluye el anfitrión del puerto. «Traer al frente» no cambia el acierto con la piel y sí en plano.
  - **N1/N2 (Q5)**.
  - **F7**: el área del puerto no pisa la silueta de 0,375 a 5; el puerto pintado es el acertado; la base la pisa.
  - **F9 (Q8 en vm)**: mismo `font` y misma línea base que pinta `drawLabelLines`.
  - **F6/P4 (Q4 en vm)**: orden de las llamadas; puntos pintados; marco en la caja lógica ±6.
  - Alcance.
- **`test/fluyo-019-4b-browser.cjs`** (Chrome real, **49/49**, unos 70 s; base `eff5129` servida de git).
  - **Q1**: plano igual que la base, píxel a píxel, en 4 estados × (plano, built 0,3, built 0,37); SVG y Present planos.
  - **Q2**: editor = Present (0 bytes) en catálogo, crema y oscuro.
  - **Q3**: 0,37 / 0,38, con clic real y el textarea abierto al cruzar el umbral.
  - **Q4**: 29/29 marcas visibles (crema y oscuro).
  - **Q5**: con ratón 60/60; con el dedo 57/57, a 0,375 / 1 / 2,5, con eventos reales e incluido N1.
  - **Q6**: 16/16 clics × 2 zooms × ratón/dedo, y arrastre desde la tapa a 2,5.
  - **Q7**: más de 4 600 puntos, 0 divergencias; «Traer al frente».
  - **Q8**: Plex Mono 500 y 0 px de línea base. Cambiar «Aspecto» con el textarea abierto lo recoloca.
  - **Q9**: Historia.
  - **Q11**: 390/1440 × crema/oscuro, editor y Present, 0 errores.
  - **SW**: v94 → v95.
- **`test/fluyo-019-4b-mutations.cjs`**: **20/20 U + 9/9 B** detectadas.
  - Las cuatro de Q10: quitar el área de caras (U1/B2), quitar la pasada final (U2/B1), desacoplar el predicado (U3/B3) y acertar el extremo solo en la geometría lógica (U4/B4).
  - El resto: orden de hojas y de contenedores, anfitrión del puerto, puerto sin `lift` en el acierto o en los dos, textarea sin voz o midiendo con la de siempre, marcas dentro de `drawNode`/`drawEdge`, tiradores sobre la ruta lógica, pasada final también en plano, editor plano, voz en formas sin piel, caras en plano, CACHE y firma del textarea.
  - B8 se rehízo como mutación de tres puntos (marcas dentro de `drawNode`/`drawEdge` con la piel y sin pasada final, es decir, F6 tal cual): 11 de 29 marcas tapadas. La versión de un solo punto (el marco también dentro de `drawNode`) es equivalente a la vista, porque la pasada final lo vuelve a pintar encima; esa la caza U11 por el orden de las llamadas. U19 es la misma de tres puntos en vm.
  - Dos sobrevivieron en la primera pasada; se endurecieron los fixtures y ahora se detectan:
    - U6: los dos contenedores solapados tenían igual área y desempataban como el pintado;
    - U17: ningún par de puertos solapados tenía distinto orden de pintado y de documento.
- **`test/fluyo-019-4b-undo.cjs`**: deshace 019.4b en los alcances de revisión fija (decisión 218). Sustituye cada región tocada por la de `eff5129` y se aplica antes que `undo4a` y `undoSemantics`.

### Adaptadas

- **Revocación de la 202 por la 226**:
  - `fluyo-019-1.test.cjs`: `editorSkin()` en el viewport;
  - `fluyo-019-2.test.cjs`: el editor sigue al documento;
  - `fluyo-019-2-browser.cjs`: CACHE.
- **Forma de código que se movió**:
  - `fluyo-018-13.test.cjs`: `drawNodeSelection`;
  - `fluyo-018-16.test.cjs`: `drawEdgeHandles` y el `lift` del puerto.
- **`undo4b` cableado** en los alcances de 019.4a, D6, FLOW-FADE, HIT-TEST, PRSKIN y SCENARIOS-SEMANTICS 1 y 2. En FASE 2 se compara el `git diff --no-index` del texto con 019.4b deshecho.
- **CACHE**: el literal `fluyo-static-v94` pasa a `v95` en 55 archivos de test (69 literales).

### Regresión

Se midió en clones del scratchpad, nunca en el árbol de trabajo:
- la base: `eff5129`;
- el árbol de 019.4b: copiado sobre `eff5129` en un commit desechable, sin `FLUYO-019.4.md`.

Así, los alcances que comparan con `HEAD` o miran `git status` miden lo mismo que tras el commit real. Los tests del clon medido son byte a byte los del árbol.

- **vm** (`node --test test/*.test.cjs`):
  - base: 1400 tests, 81 fallos, 2 omitidos;
  - 019.4b: 1412 tests, 81 fallos.

  Es exactamente el mismo conjunto de fallos (0 nuevos, 0 arreglados); los 12 tests de más son los de 4b. El único fallo nuevo de la primera pasada era de 4b y se corrigió antes de medir: el smoke del SW nombraba la CACHE anterior como literal y lo vigila `fluyo-019-1`.
- **Navegador** (todas las `test/*-browser.cjs`, una a una):
  - base: 45 suites, 37 OK, 8 fallan;
  - 019.4b: 46 suites, 38 OK, las mismas 8 fallan.

  En las 8, fallan exactamente las mismas comprobaciones que en la base (comparadas línea a línea; PRSKIN: las mismas 8 de 94). La suite nueva `fluyo-019-4b-browser` pasa, con el SW v94 → v95 incluido. **0 regresiones nuevas.**
  - La pasada de 019.4b se interrumpió por un reinicio de la sesión después de 38 suites (todas iguales a la base). Las 8 que faltaban (FLOW-FADE, HIT-TEST, PRSKIN, `scenario-qa` y las 5 de Share) se corrieron después, solas y sobre el mismo clon. No se repitieron las 38 ya medidas.
  - Las 8 caídas previas: `011`, `018-5`, `018-9`, `018-10`, `018-12`, `018-19`, `018-23` y `019-prskin`. Son textos y controles del chrome de la cabecera y del panel, medidas de pantallas, `prompt`/`alert` y el recuento de elementos de PRSKIN, todo igual en la base. 018-9 y 018-10 no arrancan sin el Playwright completo.
- **Mutaciones de slices anteriores** con 019.4b puesto:
  - 4a 15/15;
  - FLOW-FADE 11/11;
  - SCENARIOS-SEMANTICS FASE 1 26/26 y FASE 2 18/18;
  - D6 9/9 U (U1/U2 se volvieron a dirigir a `nodePaintLayers` y su test estático se endureció);
  - solo se ejecutaron las vm (U): las B de esos slices miden su propio pintado, que 019.4b no toca, y sus suites de navegador pasan en la regresión;
  - HIT-TEST 10/11: sobrevive la U0 (CACHE), que ya sobrevivía en `main` antes de 019.4b;
  - 019.2: su ejecutor no arranca porque la copia sin mutar ya falla en la base (alcances contra `HEAD`). Su U9 se invirtió («el editor vuelve a ser plano») y la caza el test de `editor-runtime`.
- **fluyo-mcp**: `check:kernel` OK contra el árbol (ningún archivo del kernel cambia); `efb316f`, árbol limpio.

## Deuda y riesgos residuales

1. **N3** (anillo de Requisito frente a anillo de salida de la piel): FASE 4.
2. **Textarea en plano**: con Georgia, la línea base del textarea y la del lienzo difieren 3 px a zoom 2 (1,5 u). Ya pasaba antes de 4b, está medido en Q8 como control y no se toca, porque el plano debe quedar idéntico. Con la piel (Plex Mono) son 0 px. Tarea aparte si se quiere corregir.
3. **Con el dedo a zoom bajo**, un codo o una barra a menos de un radio de dedo de un extremo lo captura el extremo:
   - el radio es de 22 px de pantalla, unas 58 u a 0,375;
   - es el orden de la 144 y pasa igual en plano;
   - Q5 lo distingue de un solape que introdujera la piel, y no hay ninguno.
4. **Tolerancia**: la franja + 4 y las esquinas vacías de la envolvente rectangular (`skinExtent`) pueden acertar un nodo que no pinta ese punto. Es el contrato P3 y Q7 lo descuenta.
5. **«Traer al frente / Enviar atrás»** no tiene efecto visible entre hojas con piel (P2, aceptado). No hay aviso en la UI; se puede valorar aparte.
6. **Rendimiento**: el editor con la piel cuesta lo que medía 019.4 §6 (+20–25 % de fotograma con 300 nodos). El recorte por vista sigue siendo una tarea aparte.
7. **MCP**: sin cambios. Sigue pendiente el port de 019.4a/D6 (brecha previa, 2 tests del MCP).
8. **Cosmético, no bloquea**:
   - el marco discontinuo de «Conectar» táctil (`drawLinkOrigin`, ±10 px) cruza la tapa a zoom > 1,25;
   - la vista previa de soltar marca las cuatro anclas lógicas, que con la piel quedan sobre la tapa y el lateral.

   Las dos se pintan después de los nodos, así que se ven. Se podrían apartar con `connectPortLift`, pero eso no forma parte del contrato de 4b.
9. **Rótulo de un contenedor**: queda centrado bajo sus hijos y asoma por encima de la tapa de una hoja. Pasa igual en plano (visto en Q4) y no es de 4b.

## Handoff

### Qué se hizo
019.4b completa:
- piel en el editor con el `render()` de Present;
- predicado único;
- pasada final de marcas;
- acierto sobre lo que se ve (orden y caras);
- extremos en la punta pintada;
- puerto fuera de la silueta;
- voz del textarea;
- CACHE v95;
- batería vm, de navegador y de mutaciones;
- `undo4b`;
- documentación (decisiones 226–229 y ARCHITECTURE).

### Archivos modificados
- Producto:
  - `js/render.js`, `js/interaction.js`, `js/geometry.js`;
  - `js/editor-runtime.js`, `js/state.js`;
  - `index.html`, `sw.js`.
- Tests nuevos: `test/fluyo-019-4b.test.cjs`, `test/fluyo-019-4b-browser.cjs`, `test/fluyo-019-4b-mutations.cjs` y `test/fluyo-019-4b-undo.cjs`.
- Tests adaptados: ver § Pruebas.
- Docs: `.ai/DECISIONS.md`, `.ai/ARCHITECTURE.md` y esta tarea.

### Pruebas ejecutadas
- vm de 4b: 12/12.
- Chrome de 4b: 49/49.
- Mutaciones: 20/20 U y 9/9 B.
- Regresión: vm 1412/81 contra 1400/81 de la base, el mismo conjunto de fallos. Navegador: 46 suites contra 45, las mismas 8 caídas previas con las mismas comprobaciones. 0 regresiones nuevas (§ Regresión).

### Próximo paso concreto
Con el OK del PO: commit en `main` de fluyo. Al commitear, excluir `.ai/tasks/FLUYO-019.4.md`, que sigue sin seguimiento como antes.

Después:
- push;
- comprobar que fluyo.space sirve v95.

El siguiente CACHE libre será v96.

MCP: nada que hacer en 4b.
