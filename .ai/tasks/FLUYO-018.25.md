# FLUYO-018.25 — La ruta que se dobla sola

Estado: **READY FOR COMMIT — P1 (estabilidad cuando cabe, recolocación mínima cuando no), P2 y puntos A implementados (§22).** Lo implementado (§18) sigue en el árbol, sin commit. Base: `e22734d` (018.24). `CACHE` v83. Sin commit, push ni deploy. Auditoría de las puntas en **§19**.
Fecha: 14 de octubre de 2026.
Owner/agente actual: libre (pendiente de revisión y de dos commits del owner, uno por repo; el despliegue manual del MCP también es del owner).

> **Alcance final de 018.25** (§8):
> 1. **R1** — geometría de las rutas en U (pares paralelos y pasillos desiguales): elimina los muñones de la captura. Se cambia en fluyo y en fluyo-mcp, con los goldens actualizados.
> 2. **D9 acotada** — edición de rutas: una recta no ofrece barras ni materializa waypoints colineales innecesarios, y un clic sin mover no modifica el documento ni crea entrada de Undo.
> 3. **D5** — la aserción obsoleta del test de contrato del MCP.
>
> **Fuera:** flechas configurables (018.27), el segundo bug (2a/2b, a la espera del vídeo), el zigzag del router (2b), las 4 diagonales del extremo flotante (F6) y la normalización de documentos antiguos al mover nodos (F5).

> Repo público: solo contenido técnico del proyecto open source.
> **Este documento es el único archivo escrito.** No se ha tocado código, tests, `CACHE`, el MCP ni el workflow.
>
> Las pruebas que modifican código se hicieron **en la página** (inyección en tiempo de ejecución) o en **clones del scratchpad**, nunca en los repos. Scripts, en el scratchpad de la sesión:
> - `repro-capture.cjs`, `sweep-stubs.cjs`, `proto-lane.cjs`, `proto-golden.cjs` y `lane-mcp/` (nuevos en v2);
> - `repro-route.cjs`, `repro-move.cjs`, `matrix.cjs`, `misc.cjs`, `shots-close.cjs` y `run-inline.cjs` (v1).
>
> Fuentes: `AGENTS.md`, `.ai/ARCHITECTURE.md`, `.ai/DECISIONS.md` (hasta la 189) y las tareas 018.21–018.24. Código:
> - `js/geometry.js`: `orthoRoute`, `edgePoints`, `parallelLane`, `bendableSegs`, `edgeStroke`;
> - `js/interaction.js`: manejadores, gestos de tramo, puerto de conectar, Escape;
> - `js/render.js`: `drawEdge` y la capa de manejadores;
> - `js/model.js`: claves de conexión;
> - `test/editor-inline.html`;
> - en el MCP: `src/svg.ts`, `test/visual-regression.test.ts`, `test/fluyo-018-16.test.ts`, `test/fluyo-017-3-qa.test.ts` y `.github/workflows/ci.yml`.

---

## 0. Decisiones del owner (cerradas)

| | Decisión | Qué implica |
|---|---|---|
| **D1** | El owner commitea 018.24 antes de continuar. **El agente no hace commit ni push.** | Paso 0 del handoff (§17). |
| **D2** | Aprobada. El bug principal es **exactamente el de la captura**: la segunda conexión forma un par paralelo y el tramo superior acaba con muñones/retrocesos. Hay que corregir la **geometría**, no ocultar el overlay. | R1 (§3.7). |
| **D3** | El segundo bug queda **fuera** de 018.25. No se elige entre 2a y 2b sin evidencia del bug original. | Documentado para una tarea futura (§4). |
| **D4** | Flechas configurables fuera; van en **018.27**. | §5. |
| **D5** | Se corrige **solo** la aserción obsoleta del test del MCP. Ni workflow ni ningún mecanismo de despliegue. | §6, una línea. |
| **D6** | El workflow no se toca: el CI es legítimo y se queda. | — |
| **D8** | **Sí.** R1 entra, con el mismo cambio en fluyo y fluyo-mcp y los goldens necesarios actualizados. | §3.7, §8. |
| **D9** | **Sí, estrictamente acotada.** Una recta no materializa barras ni waypoints colineales innecesarios, y **un clic sin mover no modifica el documento ni crea Undo**. | F1/F2/F3 + F4 en su forma mínima (§8). F5 queda fuera. |
| **D10** | **No.** Las 4 diagonales del extremo flotante (F6) quedan fuera. | — |
| Gesto del puerto | El owner no puede confirmar cómo apareció la segunda conexión. **El diagnóstico no depende de eso.** | §3.6 queda solo como contexto. |

---

## 1. Estado real del repo (verificado con git)

| | fluyo | fluyo-mcp |
|---|---|---|
| Rama / `HEAD` | `main` / `4a6d028` (018.23) | `main` / `81ee6d4` (018.22) |
| `origin/main` tras `git fetch` | `4a6d028` | `81ee6d4` |
| Árbol | 40 modificados + 3 sin seguimiento: **todo es 018.24, sin commitear** | limpio |
| Producción | `fluyo.space/sw.js` → `fluyo-static-v81` (018.23) | — |

018.24 toca `js/selection.js` y `js/ui.js`, más `sw.js` v82 y 33 aserciones de `CACHE`. 018.25 no toca esos dos archivos JS, pero comparte `sw.js` (→ v83) y las aserciones. De ahí D1. Al commitear 018.24 hay que mantener LF: Git avisa de LF→CRLF en esos archivos.

## 2. Estado real de 018.24

Implementado y en estado READY FOR COMMIT en el árbol de trabajo. Su handoff coincide con el diff. 018.25 cambia **cuándo** se apila el Undo en los gestos de ruta, no **cómo** se restaura la selección, así que el contrato de 018.24 no se toca.

---

## 3. Bug principal — la captura

### 3.1 Qué muestra la captura

En tema crema, dos nodos «Nodo»:
- una conexión recta del izquierdo al derecho, más alta que el centro de los nodos;
- por encima, una **escuadra**: sale de la cara superior del nodo derecho, sube, cruza hacia la izquierda y **baja con una punta que entra en el nodo izquierdo**;
- en los dos extremos de la escuadra, el trazo vertical **sobresale por encima** del tramo horizontal: dos «segmentos auxiliares» de ida y vuelta.

Detalle clave: **la punta de la escuadra entra en el nodo izquierdo**. Es decir, la escuadra es **otra conexión** (derecho → izquierdo, de arriba a arriba), no la recta en otro estado. La recta sigue ahí, con su punta hacia el derecho.

### 3.2 Reproducción exacta (Chrome real, ratón real, tema crema, zoom 1,18; `repro-capture.cjs`)

1. Dos `rect` en (300,300) y (700,300).
2. Conexión izquierdo→derecho con el puerto derecho, soltando en el centro del derecho: `ortho`, `e`/`null`.
3. Conexión derecho→izquierdo con el **puerto de arriba del derecho**, soltando sobre el borde superior del izquierdo: `ortho`, `n`/`n`.

| | Carril (`parallelLane`) | Ruta | Inversiones |
|---|---|---|---|
| Recta izquierdo→derecho | off −14 | `390,286 … 610,286` (desplazada 14 px hacia arriba, igual que en la captura) | 0 |
| **Escuadra derecho→izquierdo** | **off +14** | `714,265 → 714,237 → 714,251 → 314,251 → 314,237 → 314,265` | **2 (28 px solapados)** |
| La escuadra sin la recta (sin hermana) | 0 | `700,265 → 700,237 → 300,237 → 300,265` (U limpia) | 0 |

La captura reproducida (`shots-capture/soltar-arriba-2-par.png`) coincide con la tuya trazo por trazo, en escala, desplazamientos y muñones. A zoom 1,18 los 28 px del pasillo son 33 px de pantalla y los 14 px del carril son 16,5 px, que son las medidas de la imagen.

**No hace falta seleccionar ni editar nada para que aparezca**: está en la ruta automática y se ve igual sin selección, en Present, en Viewer, en la exportación y en el MCP.

### 3.3 Causa raíz (confirmada)

`orthoRoute()` (`geometry.js:301-302`) coloca el canal central de una ruta con los dos lados en el mismo eje en `(s+t)/2 + off`, donde `s` y `t` son los pasillos de 28 px y `off` es el carril del par paralelo. Esa fórmula es correcta cuando los lados **se miran** (`e`/`w`, `n`/`s`): el canal cae entre los dos pasillos.

Es **incorrecta cuando los dos lados apuntan en el mismo sentido** (`n`/`n`, `s`/`s`, `e`/`e`, `w`/`w`: una U). Ahí el canal tiene que quedar **en el pasillo más exterior o más allá**. Si cae por dentro, la ruta sale 28 px, vuelve hacia el nodo y luego cruza: un **muñón exterior**. Pasa en dos casos:

- **Con carril** (par paralelo, como en la captura): `off` = ±14. La hermana cuyo carril apunta hacia los nodos mete el canal 14 px dentro de los pasillos.
- **Sin carril, con pasillos desiguales** (nodos de distinto alto o ancho, o desalineados): el punto medio queda entre los dos pasillos, así que siempre por dentro del más exterior.

**Por qué nadie lo detectaba:**
- El guardián de `orthoRoute` solo mide **penetración en las cajas** (`pathInBoxes`). Este muñón queda **fuera** de los nodos, la penetración es 0 y la ruta se devuelve tal cual («la ruta de hoy está limpia: no se toca»).
- El chequeo F del MCP (`visual-regression.test.ts`) mide lo mismo: si la ruta entra en su propio nodo. Un retroceso fuera del nodo no lo ve.
- El golden de conexiones de 018.16 (`test/fixtures/fluyo-018-16-conexiones-svg.json`, compartido por los dos repos) **ya contiene un muñón**. Su arista 10 es una U `e`/`e` sin hermana, con pasillos desiguales: `950,200 → 978,200 → 960.5,200 → 960.5,460 → …`, que retrocede 17,5 px. El golden fijó el defecto como correcto.

### 3.4 Lo demás que pide D2: un clic no puede mutilar el documento (confirmado; independiente de la captura)

Medido en la v1 (`repro-route.cjs`, `matrix.cjs`): un **clic sin mover** sobre la barra de un tramo ortogonal hace tres cosas.
- Congela los lados flotantes.
- Materializa la ruta automática en `waypoints` y apila un Undo que no deshace nada visible. Ocurre en **230 de 230** clics.
- Desde ese momento la conexión deja de rutearse sola: aparece «Volver a la ruta automática» sin haber hecho nada y, al mover un nodo, salen diagonales.

En la ruta recta (`straight`), el clic sobre el anillo **inserta un codo** sin mover.

**Causa:** `pointerdown` (`interaction.js:466-478`) llama a `pushUndo()` + `iniciarTramo()` (o hace el `splice` del codo) **antes** de que haya movimiento. El arrastre de nodos ya no lo hace desde 018.12: apila con la foto de `pointerdown` solo en el primer movimiento real.

### 3.5 Defecto vecino encontrado en la v1: dos barras en una recta (confirmado; no es la captura)

En una conexión ortogonal recta entre nodos alineados, el editor muestra **2 barras** (vértices colineales que `orthoRoute` deja en el canal degenerado). Deslizar una produce escalón + diagonal: 36 de 460 gestos en la matriz; 4 de ellos por otro mecanismo, el de extremo flotante. Es el mismo tipo de síntoma («una recta que al editarla se dobla»), pero no es la geometría de la captura. **Entra acotado por D9:** F1/F2 (`handleRoute`, una barra centrada), F3 (agarrar no escribe) y F4 en su forma mínima. Quedan fuera F5 (normalizar al mover nodos) y F6 (extremo flotante, D10).

### 3.6 Cómo pudo aparecer «al entrar en edición» (contexto, sin confirmar; el diagnóstico NO depende de esto)

La escuadra es una conexión que alguien creó. El gesto más probable es el del paso 3: pasar el ratón por encima del nodo derecho muestra un **punto** 18 px por fuera de su cara superior (el puerto de conectar, 018.16), y arrastrarlo hasta el nodo izquierdo **crea** la conexión. Desde fuera, ese punto se parece a un manejador de edición de ruta.

El owner no puede confirmar que fuera ese gesto: el vídeo original no está disponible. No se asume. Venga de donde venga la conexión, el defecto está en la geometría y el arreglo es el mismo. El contrato de cómo se distingue el puerto de un manejador **no** se toca en este slice (la UI está congelada).

### 3.7 Arreglo propuesto para la captura (R1), prototipado y medido

**Cambio**, en el mismo sitio de `orthoRoute` y en su port idéntico de `fluyo-mcp/src/svg.ts:280-281`, pasando `half` (semiancho del abanico, que `edgePoints` ya calcula):

- Lados **opuestos** (se miran): sin cambios, `(s+t)/2 + off`.
- Lados en el **mismo sentido** `u`: canal = pasillo más exterior + `u·(half + off·u)`. Con dos hermanas, una va por el pasillo exterior y la otra 28 px más allá; sin carril, por el pasillo exterior. **Nunca por dentro.**

**Medido** (prototipo inyectado en la página; `proto-lane.cjs`, `sweep-stubs.cjs`). Barrido de 10 posiciones × 25 combinaciones de lados × {sola, par en el mismo sentido, par opuesto}:

| | Aristas con muñón (sola / par mismo sentido / par opuesto) | Aristas que entran en su caja | Hermanas encimadas | Corpus publicado (8 ejemplos, 61 aristas) |
|---|---|---|---|---|
| HEAD | 2 / 10 / 10 | 0 | 0 | — |
| **R1** | **0 / 0 / 0** | 0 | 0 | **0 aristas cambian** |

- El caso de la captura queda `714,265 → 714,237 → 314,237 → 314,265`: una U limpia por encima de la recta (`shots-capture/prototipo-par.png`).
- **MCP, medido en clones del scratchpad** (R1 en `geometry.js` y portado a `svg.ts`; `lane-mcp/`), con `REQUIRE_FLUYO=1 npm test`: 690 tests, 688 pass. Los 2 fallos son:
  - el de contrato previo (§6), que no tiene relación con R1;
  - **el golden de conexiones de 018.16**, porque su arista 10 deja de tener el muñón (§3.3). Paridad vértice a vértice, regresión visual (chequeos A–F + BASELINE) y auto-layout siguen en verde.
- Por tanto **R1 obliga a regenerar ese golden** (`FLUYO_UPDATE_GOLDEN=1` en el MCP, copiado a `fluyo/test/fixtures`). Lo vigila la prueba de identidad de `fluyo-018-16.test.cjs`. El golden nuevo se revisa a mano: solo cambia la arista 10 y deja de tener retroceso.

**R1 cambia la geometría compartida.** Eso implica dos cosas:
- Toca el **MCP** (`svg.ts`, dos líneas y la firma, más el golden). Sin el port, el job de sincronía de CI se pone rojo, que es su trabajo, y `export_diagram` seguiría dibujando el muñón.
- Para que el MCP en producción dibuje igual que el editor hace falta **tu despliegue manual habitual**. El proceso no cambia; yo no despliego.

Esto es D8.

---

## 4. Segundo bug — evidencia (D3)

**Qué se pidió** (CONNECTOR-INTERACTION-001, BUG 2): «el segundo vídeo muestra otro comportamiento extraño relacionado con mover nodos y las conexiones que los unen». La lista de «especial atención» era de aspectos a observar (acercar, solapar, anclaje, punta, orden Z, actualización en vivo, handles, «dentro» del nodo, recuperación, si modifica el modelo), **no una descripción del síntoma**. El propio encargo decía «no voy a definirte previamente cuál es la causa».

**Qué evidencia tengo del vídeo: ninguna.**
- En la sesión de ese encargo, el mensaje llegó **sin adjuntos**: el transcript registra 0 imágenes y 0 vídeos. La sesión se interrumpió en el arranque, antes de cualquier análisis.
- En esta sesión tampoco hay vídeo; solo la captura del bug principal.

**Qué son 2a y 2b:** defectos que **encontré explorando** esos aspectos, no reproducciones del vídeo.

| | Qué es | Evidencia | ¿Es el bug del vídeo? |
|---|---|---|---|
| **2a** | Tras un clic en la barra (§3.4), mover un nodo deja diagonales y la ruta entra en el nodo. | `repro-move.cjs`, `shots-move/materializada-B-arriba.png` | Indeterminable. Encaja con «dentro del nodo» y «punta», pero exige un clic previo que el encargo no menciona. |
| **2b** | Con caras enfrentadas a menos de 56 px (2 × pasillo), la ruta automática hace zigzag; solapados, la punta queda dentro. | `repro-move.cjs`, `shots-move/cerca-flotante-sel.png` | Indeterminable. Encaja con «se acercan mucho o se superponen». |

**Conclusión: no se puede determinar → el segundo bug queda fuera de 018.25** (D3, cerrada). Queda documentado aquí para una tarea futura, que necesita el vídeo o una descripción del síntoma antes de elegir entre 2a, 2b u otro. Los scripts `repro-move.cjs` y `shots-close.cjs` sirven de punto de partida.

Dos efectos colaterales, sin atribuirlos al bug pedido:
- El arreglo del clic (§3.4) elimina la **condición** que produce 2a.
- 2b es de la misma familia que R1 (retrocesos que el guardián no mide), pero **R1 no lo arregla**: aquí el problema es el hueco < 2·pad entre caras que se miran, no el canal de una U.

---

## 5. Tamaño de flecha → 018.27 (D4 aprobada)

Sin cambios respecto a la v1. Resumen de la auditoría:
- las constantes globales están en `geometry.js:418` y en `svg.ts:819`;
- escalan con el zoom como la línea y no dependen del grosor;
- escribir un campo nuevo exige tocar `model.js` (kernel: `CONNECTION_SPEC_KEYS`/`UPDATE_KEYS` y normalización), sincronizar el kernel del MCP, portar a `svg.ts`, ampliar los esquemas `model.ts`/`authoring.ts` y desplegar el MCP;
- Share, Viewer y Present lo heredarían solos.

Propuesta para 018.27: `arrowSize` ∈ {1, 1.5, 2}, donde ausente significa el tamaño actual. Multiplica `LEN`/`HALF`/`NOTCH` (no `GAP` ni `EDGE_W`) y se elige con un segmentado bajo «Puntas».

## 6. CI de fluyo-mcp (D5/D6 cerradas)

- Es legítimo (clase A): `e807185`, 02-08-2026, cierra DRIFT 7.4. Está documentado en README, CONTRIBUTING, DRIFT y AGENTS. No despliega ni escribe en ningún repo.
- **Verificado que el rojo es solo una aserción obsoleta** (clon del scratchpad, cambiando **solo** esa línea):
  - el cambio: `test/fluyo-017-3-qa.test.ts:342` añade `"waitsForArrivalOf"` a la lista de `add_step`;
  - el campo lo añadió a propósito 018.22 (`81ee6d4`, `src/authoring.ts:205`) y está documentado en la descripción de la tool;
  - job «Sincronía» (`REQUIRE_FLUYO=1 npm test` con fluyo/ al lado): **690/690**, 9 s;
  - job «Build y tests» (sin fluyo/): **657 tests, 0 fallos** (26 omitidos por diseño);
  - `check:config`/`check:kernel`: ya estaban en verde.
- **Cleanup mínimo en 018.25:** esa línea, en un commit propio de fluyo-mcp. Workflow, Vercel y despliegue manual intactos. No requiere despliegue: es un test.

---

## 7. Confirmado e hipótesis

**Confirmado** (medido en Chrome real o en clones):
- la reproducción exacta de la captura;
- la causa de §3.3 (canal de U por dentro del pasillo, con carril o con pasillos desiguales; ni el guardián ni el chequeo F lo miden);
- el golden de 018.16 con muñón;
- el efecto de R1: barrido 22 → 0 muñones, corpus 0/61 cambios, MCP con paridad y regresión visual en verde;
- el clic que mutila (230/230);
- las dos barras de una recta (36/460);
- que el CI se arregla con una línea (690/690 y 657/0).

**Hipótesis:**
- Cómo apareció la segunda conexión (§3.6).
- Que F6 eliminara las 4 diagonales del caso flotante (§3.5). Queda sin comprobar: F6 está fuera (D10).
- Que no haya otros documentos de usuario con U afectadas que cambien de aspecto. Por construcción, solo cambian las rutas que **hoy tienen muñón**: el corpus no cambia (0/61), las rutas con lados opuestos no se tocan y la U con pasillos iguales sin carril da el mismo canal.

## 8. Alcance de 018.25 (cerrado)

| # | Cambio | Dónde | Por qué |
|---|---|---|---|
| **R1** | En `orthoRoute`, si los dos lados apuntan en el **mismo sentido** `u` (U): canal = pasillo más exterior + `u·(half + off·u)`. Si los lados se miran: sin cambios, `(s+t)/2 + off`. `edgePoints` pasa `half`, que ya calcula, como 8.º argumento. | `js/geometry.js`; el mismo port en `fluyo-mcp/src/svg.ts`; golden `fluyo-018-16-conexiones-svg.json` regenerado en los dos repos | D2/D8: es la geometría de la captura (§3.3, §3.7). |
| **F1** | `handleRoute(pts)`: función pura que quita los vértices interiores **sin giro** y conserva los índices 0, 1, n−2 y n−1 (anclas y pasillos). Solo para manejadores: no la usan el trazo, la exportación ni el MCP. | `js/geometry.js`, junto a `bendableSegs` | D9: una recta no ofrece barras sobre vértices colineales. |
| **F2** | Las barras de tramo de una ruta `ortho` (dibujo, acierto, cursor y gesto) trabajan sobre `handleRoute(edgePoints(e))`. Una recta lleva **una** barra, y deslizarla da un puente limpio. En una ruta en Z la lista es idéntica a la de hoy. | `js/render.js` (solo la fuente de puntos del bucle de barras); `js/interaction.js` (`hitSegment`, `segHoverCur`, `iniciarTramo`) | D9 |
| **F3** | **Agarrar no escribe.** `pointerdown` sobre una barra, un anillo (`straight`) o un codo solo anota el gesto pendiente. El primer `pointermove` que cambia el valor (ya con snap) hace `pushUndo` + congela/materializa/inserta + mueve. Un `pointerup` sin movimiento no escribe nada. Escape solo hace `undo()` si el gesto llegó a escribir. Igual con dedo. | `js/interaction.js` | D2/D9: un clic sin mover no modifica el documento ni crea Undo. |
| **F4** (mínima) | Al **soltar un deslizamiento de tramo**, si la ruta resultante es entera colineal (`[p1,…wps,p2]` en una sola línea), `waypoints:[]`: vuelve a ser automática. Es la poda que ya existe en `podarWaypoints`, ampliada solo a ese caso. | `js/interaction.js` (`podarWaypoints`); el cálculo puro en `geometry.js` | D9: un deslizamiento que vuelve a la línea original no deja waypoints colineales. |
| **D5** | `"waitsForArrivalOf"` en la lista de `add_step`. | `fluyo-mcp/test/fluyo-017-3-qa.test.ts:342` | Aserción obsoleta tras 018.22 (§6). |
| — | `CACHE` v82 → v83 y sus aserciones; decisiones 190+; nota en `ARCHITECTURE.md`. | `sw.js`, tests, `.ai/` | Toca archivos servidos. |

**Nota de implementación F2/F3, para no desalinear índices.** Si una conexión **ya tiene** waypoints con vértices sin giro (documentos dañados por el bug del clic), el índice del tramo de `handleRoute` no coincide con el de `e.waypoints`. Por eso, en el primer movimiento real, `iniciarTramo` sustituye `e.waypoints` por `handleRoute(edgePoints(e)).slice(1,-1)` **antes** de calcular `i0/i1`.
- Ocurre solo al deslizar de verdad, después del `pushUndo`.
- Visualmente no cambia nada: solo desaparecen vértices sin giro.
- **No** es F5: no se toca nada al mover nodos.

## 9. Archivos que se tocan

**fluyo:**
- `js/geometry.js`:
  - R1 en `orthoRoute` y en la llamada desde `edgePoints`;
  - funciones nuevas `handleRoute` y el test puro «ruta colineal»;
  - `edgeStroke`, `anchorPt`, `parallelLane`, `portLane`, `slideAnchor` y `bendableSegs` no cambian.
- `js/interaction.js`: `hitSegment`, `segHoverCur`, `iniciarTramo`, `podarWaypoints`, el gesto pendiente en pointerdown/move/up (barra, anillo, codo) y Escape.
- `js/render.js`: solo la fuente de puntos del bucle de barras (~3 líneas).
- `sw.js` (v83) y las aserciones de `CACHE` en los tests que la comprueban.
- `test/fixtures/fluyo-018-16-conexiones-svg.json`: regenerado; solo cambia la arista 10.
- Nuevos: `test/fluyo-018-25.test.cjs`, `test/fluyo-018-25-browser.cjs`, `test/fluyo-018-25-mutations.cjs`.
- `.ai/DECISIONS.md` (190+), `.ai/ARCHITECTURE.md` (sección de conexiones) y esta tarea.

**fluyo-mcp:**
- `src/svg.ts`: R1, el mismo cambio y la firma de `orthoRoute` con `half = 0`.
- `test/fixtures/fluyo-018-16-conexiones-svg.json`: idéntico al de fluyo.
- Un test pequeño de U sin muñón (en `test/visual-regression.test.ts` o en un archivo nuevo `test/fluyo-018-25.test.ts`), con la misma tabla que el unitario de fluyo.
- `test/fluyo-017-3-qa.test.ts`: una línea (D5).

## 10. Qué NO se toca

- `model.js`, `config.js`, el kernel (el `check:kernel` del MCP sigue verde), el esquema y el formato.
- La rama de lados opuestos de `orthoRoute`, la lista de candidatos y su orden normativo, `edgeStroke`, `anchorPt`, `parallelLane`, `portLane` y `slideAnchor`.
- Mover nodos y realinear (`drag.realin`, `realinearExtremos`): **F5 fuera**.
- El extremo flotante en `iniciarTramo` (**F6 fuera**, D10).
- `endDrag`, `rutaAuto`, el puerto de conectar y su apariencia.
- La UI: CSS, `index.html`, panel, Share, Viewer, Present y `export.js`. Viewer, Present y la exportación heredan R1 porque llaman a `edgePoints`, sin tocar su código.
- `.github/workflows/ci.yml`, Vercel y el proceso de despliegue manual del MCP.
- Los tests históricos, salvo las aserciones de `CACHE` y el golden de 018.16.

## 11. Decisiones

Todas cerradas (§0). No quedan decisiones abiertas para implementar.

## 12. Criterios de aceptación

**R1:**
- [ ] El caso de la captura (izquierdo→derecho, `ortho` `e`/auto, y derecho→izquierdo `n`/`n`, en par paralelo):
  - la segunda conexión es una U limpia, `714,265 → 714,237 → 314,237 → 314,265`, con 0 inversiones;
  - queda por encima de la recta y separada de ella;
  - igual en el lienzo del editor, la exportación SVG del editor y `export_diagram` (golden).
- [ ] Barrido (10 posiciones × 25 lados × {sola, par mismo sentido, par opuesto}):
  - **0** aristas con muñón (HEAD: 22);
  - 0 que entren en su caja;
  - 0 hermanas encimadas.
- [ ] Rutas con lados opuestos: `edgePoints` idéntico a HEAD en todo el barrido.
- [ ] Corpus `ejemplos/data`: **0 de 61** aristas cambian (byte a byte).
- [ ] Golden 018.16 regenerado: solo cambia la arista 10, que deja de retroceder. Las dos copias son idénticas.
- [ ] MCP `REQUIRE_FLUYO=1 npm test` en verde (≥ 690/690). Paridad y regresión visual sin cambios en el BASELINE.

**D9:**
- [ ] Una conexión ortogonal recta (horizontal y vertical, lados fijos o flotantes) seleccionada muestra **una** barra.
- [ ] Deslizarla ±60 px da 0 diagonales y 0 inversiones (puente).
- [ ] En una ruta en Z, la lista de barras y el resultado de deslizar son **idénticos a HEAD**.
- [ ] Clic o toque **sin mover** sobre una barra, un anillo o un codo:
  - el JSON de la conexión no cambia (ni `waypoints` ni `fromSide`/`toSide`);
  - `undoStack` no crece;
  - no aparece «Volver a la ruta automática».
- [ ] Matriz de clics (4 posiciones × 25 lados × barras): **0** clics que mutan (HEAD: 230/230).
- [ ] Matriz de gestos (±40): 0 diagonales por vértices colineales (HEAD: 32). Las 4 del extremo flotante quedan como están: fuera de alcance (D10), y el test las tolera explícitamente por nombre.
- [ ] Deslizar y volver a la línea original deja `waypoints:[]` (F4).
- [ ] Undo tras un gesto real devuelve el JSON exacto y Redo lo reaplica. Escape a mitad devuelve el estado previo; Escape sin gesto no consume Undo.
- [ ] `editor-inline.html` 51/51.

**D5:**
- [ ] `fluyo-mcp` `npm test` en verde con fluyo/ al lado y sin él. Workflow sin cambios.

## 13. Matriz de pruebas (dirigida)

| Tipo | Archivo | Qué cubre | Objetivo |
|---|---|---|---|
| Unitario (vm) | `test/fluyo-018-25.test.cjs` | R1: U con carril ±14 y con pasillos desiguales sin retroceso; lados opuestos idénticos a HEAD (compara con el `orthoRoute` de HEAD extraído por `git show`); corpus de los 8 JSON idéntico. `handleRoute`: recta H/V → 4 puntos y barra única; Z → idéntica; `straight` → sin cambios; sin NaN. Ruta colineal → `[]`. Alcance: el diff contra HEAD solo en archivos permitidos; `edgeStroke` idéntico; `CACHE` v83. | **< 3 s** |
| Chrome escritorio | `test/fluyo-018-25-browser.cjs` (`ONLY=d1440`) | La captura con ratón real (puerto de arriba) → U limpia. Clic sin mover en barra, anillo y codo → no muta y no hay Undo. Matrices de clics y gestos. Recta: una barra y puente. Volver a la línea → `[]`. Undo/Redo/Escape. | **~20 s** |
| Chrome móvil | idem (`ONLY=m390`) | Toque sin mover en la barra → no muta; arrastre → puente. La UI no cambia: no se mide el panel. | **~8 s** |
| Mutaciones | `test/fluyo-018-25-mutations.cjs` | M1 la U vuelve al punto medio. M2 el carril hacia dentro (`u·(half−off·u)`). M3 R1 aplicado también a lados opuestos. M4 `handleRoute` devuelve `pts`. M5 `handleRoute` sin conservar los pasillos. M6 `pushUndo` de vuelta en pointerdown. M7 Escape con `undo()` incondicional. M8 F4 sin el caso colineal. Cada mutante: unitario + `ONLY=d1440`. | **≤ 2 min** |

**Regresión dirigida (solo lo que se toca):**

| Suite | Por qué | Tiempo medido |
|---|---|---|
| `fluyo-mcp`: `REQUIRE_FLUYO=1 npm test` (y una vez sin fluyo/ al lado) | Se toca `svg.ts`: paridad, regresión visual, golden y el contrato del D5. | ~9 s cada una |
| `test/editor-inline.html` (runner Playwright mínimo en el test nuevo) | Única suite existente de los gestos de tramo; F2/F3 cambian esos gestos. | 51/51 en 3,6 s |
| `test/fluyo-018-16.test.cjs` | Identidad del golden compartido, que se regenera. | 0,2 s |
| `test/fluyo-018-16-browser.cjs` con `ONLY=d1440 FAST=1` | SVG del editor = golden byte a byte. El golden cambia y es la única prueba que lo cierra en navegador. **La suite completa tarda 120 s: no se ejecuta entera.** | a medir, objetivo < 30 s |
| `test/fluyo-018-24.test.cjs` | F3 cambia cuándo se apila el Undo. | 0,9 s |

**No se ejecutan:**
- Share, Viewer, Present, Historias, panel y modelo/kernel: no se toca su código. Que pinten igual lo cubre la identidad del corpus en vm, porque todos usan `edgePoints`.
- La batería histórica completa.

## 14. Tiempos objetivo

| Bloque | Objetivo |
|---|---|
| Unitarios | < 5 s |
| Chrome | < 3 min (≈ 20 + 8 + 4 + ≤ 30 s) |
| Mutaciones | < 2 min |
| MCP | ~20 s (dos pasadas de `npm test`) |

## 15. Riesgos

- **R1 cambia la geometría compartida.** Lo acotan:
  - solo cambian las U que hoy retroceden;
  - corpus 0/61 y lados opuestos idénticos;
  - el MCP queda verde salvo el golden, que se regenera y se revisa a mano.
- **Documentos de usuarios con U afectadas cambian de aspecto**, a mejor: desaparece el muñón. Es geometría derivada: no se escribe en el documento.
- **Desfase del MCP en producción** hasta el despliegue manual del owner: `export_diagram` dibujará el muñón viejo hasta entonces. El CI no se pone rojo: compara el código commiteado, que irá portado.
- **F3:** riesgo de perder el Undo del primer movimiento. Se mitiga con el patrón del arrastre de nodos (foto en pointerdown, apilada en el primer movimiento real) y los checks de Undo/Redo/Escape.
- **Waypoints dañados de antes:** se normalizan solo al deslizar de verdad (nota de §8). Mover un nodo con esa ruta sigue igual que hoy (F5 fuera).

## 16. Fuera de 018.25

- **Segundo bug** (vídeo pendiente): §4, con 2a y 2b documentados sin atribuir.
- **018.27** `arrowSize` (§5).
- **2b**, el zigzag del router con caras a menos de 2·pad y nodos solapados.
- **F5**: normalizar waypoints colineales al mover nodos (documentos antiguos).
- **F6**: las 4 diagonales del extremo flotante.
- Distinguir el puerto de conectar de un manejador; que `rutaAuto` libere los lados congelados.

## 17. Handoff para implementación

0. **El owner commitea 018.24** (D1). Antes de empezar, comprobar:
   - `git status` limpio en fluyo, salvo esta tarea sin seguimiento;
   - `HEAD` = commit de 018.24 y `sw.js` en v82;
   - fluyo-mcp limpio en `81ee6d4` o posterior.

   **El agente no hace commit ni push.**
1. **Tests primero.** Escribir `fluyo-018-25.test.cjs` y `-browser.cjs` y comprobar que **fallan contra HEAD** por lo que deben:
   - la captura da 2 inversiones;
   - el barrido da 22 muñones;
   - una recta lleva 2 barras;
   - 230 clics mutan;
   - 32 diagonales colineales.
2. **R1:**
   1. en `geometry.js`, comprobar en vm que el corpus da 0/61 y los lados opuestos son idénticos;
   2. portar a `svg.ts`;
   3. en fluyo-mcp, `FLUYO_UPDATE_GOLDEN=1 npm test` con fluyo/ al lado;
   4. copiar el golden a `fluyo/test/fixtures`;
   5. revisar el diff: solo la arista 10.
3. **D9:** F1 → F2 (con la nota de índices de §8) → F3 → F4 mínima, ejecutando el test nuevo tras cada paso.
4. **D5:** la línea de `test/fluyo-017-3-qa.test.ts`.
5. `CACHE` v83 y sus aserciones; decisiones 190+ en `DECISIONS.md`:
   - «el canal de una U nunca cae por dentro de un pasillo; los carriles van hacia fuera»;
   - «un manejador no se ofrece sobre un vértice sin giro»;
   - «agarrar sin mover no escribe ni apila Undo».

   Nota en `ARCHITECTURE.md`.
6. Pruebas en este orden, anotando los tiempos reales:
   1. unitario;
   2. Chrome d1440 y m390;
   3. `editor-inline`;
   4. 018-16 unitario + navegador filtrado;
   5. 018-24 unitario;
   6. MCP `npm test` (con y sin fluyo/);
   7. mutaciones.
7. Parar en **READY FOR COMMIT**, con el resumen de archivos de cada repo. Sin commit, push ni deploy. El despliegue manual del MCP es del owner.

## 18. Implementación (READY FOR COMMIT)

### 18.1 Qué se hizo, exactamente según el contrato v3

- **R1**: `orthoRoute` lleva el canal de una U (los dos lados en el mismo sentido) al pasillo exterior, con el abanico de un par paralelo abierto hacia fuera: `canal = pasillo exterior + u·(half + off·u)`. Los lados que se miran no cambian. `edgePoints` pasa `half` como 8.º argumento. Port idéntico en `fluyo-mcp/src/svg.ts`. Golden de 018.16 regenerado en el MCP (`FLUYO_UPDATE_GOLDEN=1`) y copiado a fluyo: las dos copias son idénticas byte a byte y solo cambia la línea de la arista 10.
- **D9**:
  - `handleRoute` / `edgeHandlePts` / `routeIsStraight` en `geometry.js` (solo editor).
  - Las barras (dibujo en `render.js`; acierto, cursor y gesto en `interaction.js`) salen de `edgeHandlePts`.
  - El gesto es perezoso: `routePending` se crea en `pointerdown`, y en el **primer `pointermove` que cambiaría el documento** se hace `pushUndo` y lo que antes hacía `pointerdown`.
  - `pointerup` sin movimiento no hace nada. Escape solo deshace si el gesto llegó a escribir.
  - Al soltar un **tramo**, si la ruta quedó recta, `waypoints:[]`.
  - `iniciarTramo` normaliza unos waypoints que ya traen vértices sin giro (nota de §8), solo al deslizar de verdad.
- **D5**: una línea en `fluyo-mcp/test/fluyo-017-3-qa.test.ts:342` (`"waitsForArrivalOf"`). El workflow no se toca.
- **Fuera, como se pidió**: F5 (mover un nodo **no** limpia waypoints; hay un test que lo guarda), F6 (las 4 diagonales del extremo flotante siguen y el test las tolera por nombre), 2b, segundo bug, `arrowSize`, kernel/`model.js`, formato, esquema/API del MCP, Share/Viewer/Present, UX, workflow y despliegue.

### 18.2 Desviaciones respecto al contrato

1. **R1 cambia más rutas de las que predecía la v3.** La fórmula es la aprobada, sin tocar; la predicción («solo cambian las U con muñón») era incompleta. Medido sobre el barrido de 750 páginas, cambian **solo rutas en U, todas a mejor**, en tres grupos:

   | Grupo | Aristas | Qué pasa |
   |---|---|---|
   | Tenían muñón | 22 | desaparece |
   | Hermana sana en U de una con muñón | 20 | se aparta hacia fuera (14 o 28 px) para quedar a `PARALLEL_SEP` de la otra, que baja al pasillo |
   | Pares en U que el guardián había juntado en **un canal compartido** (172–372 px de trazo común: el caso «dos flechas que van juntas» de la decisión del mantenedor en `visual-regression.test.ts`) | 60 | el canal exterior ya sale limpio y quedan **separadas** (0 px compartidos) |
   | Cualquier otra (lados que se miran, U sola sin muñón, no-U) | 0 | — |
   | Corpus publicado | 0 de 61 | — |

   El test unitario fija exactamente esta clasificación, no una aproximación. Si prefieres que los 60 de la tercera fila se queden como estaban (juntos), hace falta una regla distinta de la aprobada; no lo he hecho.
2. **El test de alcance de 018.24 falla antes del commit** (`fluyo-018-24.test.cjs` #9 exige `render.js` idéntico a HEAD). Es el patrón conocido de «alcance contra HEAD»: pasa en cuanto se commitee 018.25. No es una regresión.
3. **`routePending` vive en `interaction.js`** y no en `state.js`, donde están `segDrag`/`wpDrag`, porque el contrato no incluía `state.js`. Es un detalle de ubicación, sin efecto funcional.
4. **El test de Chrome incluye `editor-inline.html`** como pasada de regresión, tal como preveía §13, en lugar de un runner aparte.

### 18.3 Criterios de aceptación

| Criterio | Resultado |
|---|---|
| La captura (par recta + vuelta n/n) | U limpia `714,265 714,237 314,237 314,265`, 0 retrocesos. Igual en el lienzo, en el SVG del editor (punta hacia abajo, al borde) y en `export_diagram` (golden + paridad) |
| Barrido | 0 muñones (HEAD 22), 0 rutas que entren en sus nodos, 0 diagonales, 0 hermanas encimadas, nunca más trazo compartido que en HEAD; donde actúa R1, hermanas a `PARALLEL_SEP` |
| Lados que se miran | Idénticos a HEAD vértice a vértice en todo el barrido |
| Corpus | 0 de 61 aristas cambian |
| Golden 018.16 | Solo cambia la arista 10, que deja de retroceder; copias idénticas |
| Fluyo = MCP | Paridad vértice a vértice en el barrido de 750 páginas + la captura (1252 aristas) |
| Una recta | Una barra, centrada; deslizar ±60 da un puente limpio |
| Clic o toque sin mover | **Inerte**: 0/220 en la matriz, más barra, Z, anillo, codo y toque m390. Ni JSON, ni Undo, ni el contenido de Rehacer, ni «Volver a la ruta automática» |
| Movimiento real | **Exactamente una** entrada de Undo (0/440 gestos con otra cuenta). Undo da el JSON exacto y Redo el del gesto |
| Escape | A mitad, estado previo. Sin gesto, ni documento ni pilas (con una edición previa en la pila: un `undo()` de más se notaría) |
| Volver a la recta al soltar | `waypoints:[]` |
| Diagonales en los 440 gestos | 0 (las 4 conocidas de F6 siguen, fuera de alcance) |
| F5 | Mover un nodo no limpia waypoints hechos a mano |
| `editor-inline.html` | 51 ✓ · 0 ✗ |
| CI del MCP | Verde en las dos configuraciones del workflow |

### 18.4 Pruebas ejecutadas (dirigidas, sin baterías históricas)

| Suite | Resultado | Tiempo |
|---|---|---|
| `test/fluyo-018-25.test.cjs` (vm) | **12/12** (contra HEAD: 8 fallos, todos por el motivo del §17) | 2,1 s |
| `test/fluyo-018-25-browser.cjs` d1440 + m390 | **31 ✔ · 0 ✘** (contra HEAD: 17 ✘ por los motivos del §17) | 7,5 s |
| ↳ incluye `test/editor-inline.html` | 51 ✓ · 0 ✗ | (dentro) |
| `test/fluyo-018-16.test.cjs` | 20/20 | 0,2 s |
| `test/fluyo-018-16-browser.cjs` `ONLY=d1440 FAST=1` | 114 ✔ · 0 ✘ | 21 s |
| `test/fluyo-018-24.test.cjs` | 9/10 (#9 alcance contra HEAD, ver 18.2.2) | 0,5 s |
| `test/fluyo-018-25-mutations.cjs` | **11/11 detectadas** (6 vm + 5 Chrome) | 63 s |
| fluyo-mcp `REQUIRE_FLUYO=1 npm test` (con fluyo/) | **693/693** | 10 s |
| fluyo-mcp `npm test` sin fluyo/ (copia aislada) | 660 · 0 fallos · 27 omitidos por diseño | 10 s |
| fluyo-mcp `check:config` / `check:kernel` | Con fluyo/: sincronizados (el kernel no cambia). Sin fluyo/: «omitido», exit 0 | — |
| Mutación del port `svg.ts` (copia aislada: la U vuelve al punto medio) | La detectan `fluyo-018-25.test.ts` (2) y la paridad del barrido (1) | ~15 s |

Objetivos: unitarios < 3 s ✔ · Chrome < 30 s ✔ (7,5 + 21 s) · mutaciones < 2 min ✔.

Una mutación sobrevivió en la primera pasada: «Escape deshace aunque no hubiera gesto». El test la dejaba pasar porque la pila de Undo estaba vacía. Se endureció el caso con una edición previa en la pila y ahora se detecta.

**Regresiones:** ninguna. El único rojo es el test de alcance de 018.24 contra HEAD, que se resuelve con el commit.

### 18.5 Archivos modificados

**fluyo** (sin commitear):
- `js/geometry.js`: R1 en `orthoRoute` y la llamada desde `edgePoints`; `handleRoute`, `edgeHandlePts`, `routeIsStraight`.
- `js/interaction.js`: `hitSegment`, `segHoverCur` e `iniciarTramo` sobre `edgeHandlePts`; `routePending`, `routeGestureMoves` y `startRouteGesture`; pointerdown, pointermove y pointerup; `cancelGestures`; Escape; F4 al soltar un tramo.
- `js/render.js`: la fuente de puntos del bucle de barras.
- `sw.js`: v83. 36 tests históricos: solo la aserción `fluyo-static-v82` → `v83`.
- `test/fixtures/fluyo-018-16-conexiones-svg.json`: golden regenerado, una línea.
- Nuevos: `test/fluyo-018-25.test.cjs`, `test/fluyo-018-25-browser.cjs`, `test/fluyo-018-25-mutations.cjs`.
- `.ai/DECISIONS.md` (190–193), `.ai/ARCHITECTURE.md` (sección 018.25) y esta tarea.

**fluyo-mcp** (sin commitear, sin desplegar):
- `src/svg.ts`: el mismo R1 y `half` en la firma de `orthoRoute`.
- `test/fixtures/fluyo-018-16-conexiones-svg.json`: el mismo golden.
- `test/fluyo-017-3-qa.test.ts`: D5, una línea.
- `test/visual-regression.test.ts`: un `it` nuevo de paridad para las rutas en U (barrido de 750 páginas).
- Nuevo: `test/fluyo-018-25.test.ts`.

### 18.6 Para el owner

- **Dos commits**, uno por repo, sin push ni deploy por mi parte. Al commitear, mantener LF en los archivos de fluyo, como en 018.24.
- **Despliegue manual del MCP** después de su commit, para que `export_diagram` en producción dibuje igual que el editor. Hasta entonces el MCP desplegado dibuja el muñón viejo; el CI no se pone rojo, porque compara el código commiteado, que ya va portado.
- **Revisar la desviación 18.2.1**: 60 aristas de pares en U que antes compartían canal ahora van separadas.

## 19. Auditoría de las puntas de flecha (petición del 14-10-2026, durante la implementación)

**Contexto.** La captura enviada durante la implementación (tema oscuro, tres nodos) **todavía no tenía R1**: R1 no estaba implementado en ningún entorno. Se ven los muñones (la vertical sobresale por encima del tramo superior en los dos extremos de la escuadra).

**Qué se revisó.** El render real de la punta en el lienzo, el SVG del editor y el MCP, en cuatro casos y con HEAD frente a R1: A recta horizontal, B recta vertical, C U que termina en vertical (el par de la captura y una U sola con pasillos desiguales), D U que termina en horizontal (par `e`/`e`). Hubo medidas numéricas sobre `edgeStroke` y capturas a zoom 1 y 2,5 (`heads.cjs`, en el scratchpad).

| Pregunta | Respuesta |
|---|---|
| `<marker>`, `markerWidth/Height`, `markerUnits`, `refX/refY`, `orient`, `viewBox` | **No existen.** Desde 018.16 (decisión 143) la punta es un polígono explícito: relleno en el lienzo (`render.js:843`), `<path>` en el SVG del editor (`export.js:335`) y en `svg.ts`. El 018-16 test ya prohíbe `<marker>`. |
| Geometría | `edgeHeadSegs`: aguja con muesca de **11 × 8** (`EDGE_HEAD_LEN=11`, `HALF=4`, `NOTCH=2,8`), punta a `EDGE_GAP=3` del ancla, línea de `EDGE_W=1,5` recortada hasta la muesca. Relleno del color de la línea, sin trazo. |
| Escala con zoom | En unidades de mundo, como la línea: a zoom 1 son 11 × 8 px de pantalla. No hay transformación aparte. |
| Posición respecto al último tramo | `strokeDir` toma el último tramo con longitud. En los 4 casos, con HEAD y con R1, la punta entra **perpendicular al borde**, a **3,00** del ancla, con **8,8 px** de tramo recto delante (9,8 y 14,3 en HEAD por el muñón). |

**Conclusiones:**
1. **La horizontal «extremadamente pequeña» → «Es solamente la limitación del tamaño fijo que ya dejamos para 018.27».** No es un bug del marker (no hay marker) ni de escala. Es la aguja de 11 × 8 decidida en 018.16, y a su lado los puntos de flujo (radio 5 con halo de 9, unos 18 px) la hacen parecer aún menor.
2. **El «pequeño remate vertical» de la U → no es la punta: es el muñón**, el bug de geometría que corrige R1 en este slice. La punta es idéntica en HEAD y con R1. En HEAD la vertical sigue 14 px por encima de la esquina y forma una T con el tramo superior; con R1 la U dobla con su esquina redondeada y entra limpia (`shots-heads/C_U_vertical_par-{HEAD,R1}-z2.5.png`). **No es consecuencia de R1**, y R1 no produce ninguna orientación ni posición incorrecta de la punta.

**Regresión añadida en 018.25** (`fluyo-018-25.test.cjs`, «puntas»). En las 1252 aristas del barrido y la captura, medido sobre lo que se **dibuja** (`edgeStroke`):
- la punta entra perpendicular al borde;
- queda a `EDGE_GAP` del ancla;
- tiene ≥ 8,8 px rectos delante (no queda montada en la curva);
- el trazo no retrocede junto a ella.

Contra HEAD falla por el muñón pegado a la punta, que es el caso de la captura. El test de Chrome comprueba además la punta en el SVG del editor.

**Qué hay que cambiar en 018.27 (no se toca ahora):**
- `geometry.js` `edgeHeadSegs`/`edgeStroke` y `svg.ts` (port): multiplicar `EDGE_HEAD_LEN`, `EDGE_HEAD_HALF` y `EDGE_HEAD_NOTCH` (y el recorte `trim`, que usa `GAP + LEN − NOTCH`) por el factor `k = arrowSize ?? 1`. No tocar `EDGE_GAP` ni `EDGE_W`.
- `model.js` (kernel): `arrowSize` en `CONNECTION_SPEC_KEYS`/`CONNECTION_UPDATE_KEYS`, más su validación y normalización (enum; ausente = 1). Luego `sync:kernel` en el MCP, el esquema `model.ts`/`authoring.ts` (`create_connection`, `update_connection`) y el despliegue manual.
- UI: un segmentado bajo «Puntas», con Undo por `pushUndo` + `editEdge`.
- **Límite geométrico medido.** El tramo recto delante de la punta, en el pasillo de 28 px con esquina de 8, vale `17 − 8,2·k`:
  - k = 1: 8,8 px;
  - k = 1,5: 4,7 px;
  - k = 2: 0,6 px; la base de la punta llega al final de la curva;
  - k > 2,07: la punta se monta en la curva.

  Por eso 018.27 debe elegir entre {1, 1,25, 1,5} o alargar el pasillo para las puntas grandes. La aserción «≥ 8,8 px rectos» de 018.25 tendrá que pasar a `≥ 17 − 8,2·k`.


## 20. Dos bugs nuevos tras la revisión con capturas y vídeo (DIAGNÓSTICO — sin código)

Scripts en el scratchpad:
- `diag2.cjs`: mismo diagnóstico contra HEAD, exportado con `git archive`, y contra el árbol con R1.
- `proto2.cjs` / `proto2b.cjs`: reglas propuestas inyectadas en la página.
- `video/`: fotogramas del vídeo del owner, extraídos con ffmpeg; el original no se toca.

### 20.1 BUG 1 — la conexión directa se desplaza al añadir una hermana

**Reproducido** en Chrome. Dos nodos enfrentados, A→B creada con el puerto (`e`/auto); después, B→A de arriba a arriba (`n`/`n`).

| Variante | Directa A→B (HEAD **y** árbol con R1) |
|---|---|
| Sola | centrada (dy 0) |
| A→B primero, luego B→A n/n | **−14** (sube) |
| B→A n/n primero, luego A→B | **+14** (baja; es tu captura: B→A tenía id o posición menor) |
| B→A s/s (por abajo) | −14 |
| Dos A→B iguales | −14 / +14 |
| A→B + B→A, las dos directas | −14 / +14 |
| Recta (`straight`) + B→A n/n | −14 |
| La captura con B movido 40 px | sigue −14 |
| SVG del editor | igual (`edgePoints`); Present y Viewer cargan el mismo `geometry.js` y `render.js` (`s/index.html`); el MCP porta `parallelLane` |

**Causa raíz (confirmada):** no es R1. Es **`parallelLane`** (`geometry.js:91`, de antes de 018.25; port en `svg.ts:86`).
- Agrupa como «hermanas» **todas** las conexiones sin waypoints entre el mismo par de nodos, compartan o no algún tramo.
- Las reparte **simétricamente**: `off = (i − (n−1)/2)·28`, según su orden en `P().edges`.
- `slideAnchor` corre las anclas a lo largo de su lado.

Dos efectos:
1. La directa `e`/`w` y la U `n`/`n` no comparten ni un lado ni un tramo, pero la directa se aparta 14 px igualmente.
2. Añadir una hermana **mueve la existente**. En el barrido de 500 pares, la primera cambia de ruta al añadir la segunda en **500 de 500**.

R1 solo decide dónde va el canal de la U, y no interviene en la directa. HEAD da exactamente las mismas cifras.

**Regla general propuesta (P1), que sustituye al reparto por par de nodos y absorbe el carril de R1:**
1. **Carril por CANAL, no por par.** Comparten carril solo las conexiones del mismo par de nodos que salen y llegan **por los mismos lados** (lados resueltos con `baseAnchors`, en marco canónico por id). Las de lados distintos no se tocan: la directa y la U de la captura van cada una por su sitio, sin desplazamientos.
2. **Estable.** Dentro de un canal, la conexión que ya estaba (id menor) conserva el carril 0, y las siguientes se apartan hacia fuera (+28, −28, +56…). Añadir o quitar una hermana no mueve las anteriores.
3. **Canal central para la directa.** Entre caras que se miran, el carril 0 es el canal central de siempre.
4. **U anidadas.** En una U, el carril k va k·28 más afuera, con sus anclas apartándose del otro extremo, para anidar sin cruzarse. Sustituye a `u·(half + off·u)` de R1.
5. `siblingCount` (que usa `portLane`) pasa a contar por canal.

**Medido** (P1, prototipo en la página, frente al árbol con R1):

| | Árbol (R1) | P1 |
|---|---|---|
| Directa de la captura y de todas sus variantes | ±14 | **0, centrada**, idéntica con y sin hermana |
| Barrido: la primera cambia al añadir la segunda | 500 / 500 | **0** |
| Barrido: muñones / dentro de su nodo / diagonales | 0 / 0 / 0 | 0 / 0 / 0 |
| Barrido: cruces entre hermanas | 84 | **56** |
| Barrido: pares con trazo compartido | 290 | 286 |
| Dos U n/n | anidadas al revés (la nueva por dentro) | la existente en el pasillo, la nueva 28 px fuera y anclas fuera, 0 cruces |
| Corpus `ejemplos/data` | — | **0 de 61** cambian |
| Fixtures de regresión del MCP (`regresion-visual/`) | — | cambian **exactamente 4**: los pares bidireccionales de `ingesta-v2` (e11/e12) y `rag-chatbot` (e6/e7); la primera vuelve al centro y la segunda se aparta 28 |

### 20.2 BUG 2 — los puntos de flujo «se devuelven»

**Reproducido** con tu vídeo (fotogramas a 30 fps, conexión de ~39 px de mundo a 219 %) y en Chrome. Los puntos **no** guardan separación uniforme: se juntan y se separan. Con el reparto uniforme de `render.js` (`f = (t·sp + i/n) % 1`) eso solo puede pasar si **la ruta misma va y vuelve**.

| Conexión (caras enfrentadas, `ortho` desde el puerto) | Ruta | Retrocesos | Puntos que se mueven hacia atrás (240 fotogramas) |
|---|---|---|---|
| Hueco 200 / 100 / 60 | recta | 0 | **0** |
| Hueco 39 (el vídeo) | `390→418→410→401→429` | 2 (17 px) | **168** |
| Hueco 20 | `390→418→382→410` | 2 (56 px) | **274** |
| La misma distancia con ruta `straight` | recta | 0 | **0** |
| Vertical, mismos huecos | igual que la horizontal | — | — |

Igual en HEAD y en el árbol.

**Causa raíz (confirmada):** es geometría, no animación. `orthoRoute` pone siempre pasillos de 28 px delante de cada extremo. Entre caras que se miran a **menos de 56 px** (2·pad) los pasillos se cruzan, y la ruta avanza, retrocede y vuelve a avanzar sobre la misma línea:
- el trazo parece recto (las idas y vueltas se pintan encima);
- los puntos recorren la ruta real y **retroceden**;
- donde se cruzan ida y vuelta se **amontonan** (separación mínima 0).

Es la familia «2b» documentada en §4.2, que ahora tiene evidencia: tu vídeo. El wrap periódico **no** es la causa. La aparición casi simultánea cerca de los dos extremos (19 % de los fotogramas) es igual en todas las longitudes, incluidas las de 200 px: es el ciclo normal con 3 puntos.

**Solución propuesta, en dos partes:**
- **P2 (geometría)**: entre caras que se miran (d1 = −d2) a menos de 2·pad, los pasillos se acortan a la mitad del hueco. Es una línea en `orthoRoute`.
  - Medido: 0 retrocesos con huecos de 39, 20 y 5, en horizontal, vertical y Z (`390→410→429`).
  - 0 cambios en el corpus.
  - Rutas con huecos de 56 px o más: idénticas.
- **Puntos en conexiones cortas (render)**: incluso recta, una conexión de 39 px con 3 puntos los deja a 13 px, y los halos de 18 px se solapan (el aspecto de «acumulación»). Comparación de opciones sobre la ruta ya recta:

  | L (px) | 300 | 100 | 72 | 60 | 39 | 20 |
  |---|---|---|---|---|---|---|
  | actual (3) | 3/100 | 3/33 | 3/24 | 3/20 | 3/13 ✗ | 3/7 ✗ |
  | **A, S = 24** | 3/100 | 3/33 | 3/24 | 2/30 | 1 | 1 |
  | A, S = 18 | 3/100 | 3/33 | 3/24 | 3/20 | 2/20 | 1 |
  | A, S = 30 | 3/100 | 3/33 | **2**/36 | 2/30 | 1 | 1 |
  | C (1 si L < 54) | 3/100 | 3/33 | 3/24 | 3/20 | 1 | 1 |
  | actual (6 puntos) | 6/50 | 6/17 ✗ | 6/12 ✗ | 6/10 ✗ | 6/7 ✗ | 6/3 ✗ |
  | **A, S = 24 (6)** | 6/50 | 4/25 | 3/24 | 2/30 | 1 | 1 |

  (celda = puntos / separación; ✗ = halos solapados)

  **Recomendación: A con S = 24** (2 halos de 9 más 6 px de aire): `n = clamp(floor(L/24), 1, n configurado)`.
  - Es la única que elimina todos los solapes, también con 6 puntos.
  - No toca las conexiones de 72 px o más con 3 puntos.
  - Con un solo punto no puede haber dos a la vez en los dos extremos.
  - B (reducir separación) no aplica: la separación ya es L/n. D (separación fija en px) cambiaría todas las conexiones normales.
  - Los puntos y su halo van en unidades de mundo, así que la regla no depende del zoom. `alternate` (ida y vuelta) cambia de sentido por diseño y queda fuera de la regla.
  - Solo el lienzo anima puntos (ni el SVG del editor ni el del MCP), así que esta parte no toca el MCP.

### 20.3 Archivos

| Cambio | fluyo | fluyo-mcp |
|---|---|---|
| P1 (carriles por canal, estables; U anidadas) | `js/geometry.js`: `parallelLane`, `siblingCount`, `edgePoints`, `orthoRoute` | `src/svg.ts` (port); BASELINE/expectativas de `visual-regression` para `ingesta-v2` y `rag-chatbot` si cambian sus defectos medidos |
| P2 (pasillos cortos) | `js/geometry.js` `orthoRoute` | `src/svg.ts` |
| Puntos en conexiones cortas | `js/render.js`: un helper puro de número de puntos (testeable en vm) | — |
| Tests | `fluyo-018-25.test.cjs` (la clasificación de R1 se reescribe con la regla nueva), `-browser.cjs`, `-mutations.cjs` | `fluyo-018-25.test.ts`, `visual-regression.test.ts` (paridad del barrido) |

Sin kernel, `model.js`, formato, esquema ni UI. El golden de 018.16 se vuelve a medir: R1 ya lo cambió, y con P1 la arista 10, que no es un par, debería quedar igual que ahora.

### 20.4 ¿Caben en 018.25?

Sí, sin abrir superficies nuevas. Los dos cambios de geometría están en las mismas funciones y en el mismo port que R1, que ya entraba en 018.25. El de los puntos es un helper en `render.js`.

**Riesgo:** los dos fixtures de regresión del MCP con pares bidireccionales cambian de geometría (4 aristas). Hay que volver a ejecutar los chequeos A–F de `visual-regression`. **Condición de parada:** si aparece un defecto nuevo de etiquetas o de cruce en esos fixtures, se documenta y se decide antes de seguir.

### 20.5 Tests mínimos que lo demostrarían

- **Unitario (vm):**
  - **BUG 1:**
    - la directa es idéntica con y sin la hermana, y está centrada, en las 7 variantes;
    - en el barrido: 0 casos en que añadir una hermana mueva la primera; 0 muñones, penetraciones y diagonales; cruces y trazo compartido nunca peores que el árbol actual;
    - el carril 0 lo conserva siempre la de id menor;
    - corpus 0/61;
    - fixtures del MCP: solo cambian las 4 aristas de los pares.
  - **BUG 2:**
    - huecos 60/39/20/5 en horizontal, vertical y Z: 0 retrocesos;
    - rutas con hueco ≥ 56 idénticas a hoy;
    - simulación de los puntos (normal y reverse): 0 movimientos visibles hacia atrás y separación ≥ 24 cuando hay ≥ 2 puntos;
    - con L ≥ 24·n, el número de puntos no cambia.
- **Chrome:**
  - la captura con el gesto real: la directa no se mueve ni un píxel al añadir y al borrar la U;
  - el caso del vídeo (hueco de 39 px a 219 %): la ruta recta y un solo punto.
- **MCP:** la paridad del barrido (incluye pares y U), los tests de U y `npm test` con y sin `fluyo/`.
- **Mutaciones:** carriles simétricos otra vez; agrupar por par en vez de por canal; U anidadas sin apartar las anclas; pasillo sin acortar; sin tope de puntos; S demasiado pequeño.
- **Tiempo estimado:** el mismo orden que ahora (unitario ~3 s, Chrome ~10 s, mutaciones ~90 s, MCP ~20 s).

## 21. Implementación de P1/P2/A — DETENIDA por la condición de parada (14-10-2026)

**Hecho en el árbol (sin commit):**
- **P1** (carriles por canal, estables) en `geometry.js` y `svg.ts`.
- **P2** (pasillos que se acortan y canal acotado entre los pasillos) en los dos.
- **Puntos A** (`flowDotCount`, `FLOW_DOT_SEP = 24`) en `render.js`.
- `test/fluyo-018-25.test.cjs` reescrito: **16/16, 2,2 s**.
- `fluyo-mcp/test/fluyo-018-25.test.ts` reescrito y paridad ampliada a 812 páginas (1343 aristas): verdes.
- Golden de 018.16: sin cambios respecto a lo de R1.
- Corpus publicado: 0 de 61 aristas cambian.

**Lo que paró la implementación:** la regresión visual del MCP marca un **defecto nuevo en `rag-chatbot`**: «B: la etiqueta "pregunta" solapa "chunks relevantes"».

**Causa (medida):**
- El par e6/e7 de `rag-chatbot` sale del lado de arriba de «API» y entra por el lado izquierdo de «Pinecone».
- El ancla de la primera (e6) en Pinecone cae en y = 688, pegada a la esquina inferior del lado (el máximo utilizable es 679).
- Con P1, la primera no se mueve y su hermana va +28, pero el recorte del lado la deja en 679: a **9 px** en lugar de 28. Las dos rutas casi se juntan y la etiqueta de e7 baja hasta pisar la de e5.
- En HEAD no pasaba porque el abanico simétrico reservaba sitio moviendo **todas** las anclas hacia el centro, justo lo que P1 prohíbe para la primera.

**Alternativas medidas en copias del scratchpad** (los repos solo tienen la opción 1):

| Opción | `rag-chatbot` | Estabilidad (barrido, 500 pares) | Resto |
|---|---|---|---|
| 1. P1 tal cual (hermana recortada contra el borde) | defecto B nuevo (24 px² de solape) y hermanas a 9 px | 500/500 estables | habría que añadir B al BASELINE con justificación |
| 2. La hermana se abre hacia el lado con sitio | B resuelto, pero **e7 atraviesa el nodo «Usuario»** (defecto C nuevo) | 500/500 | peor que 1: cruzar un nodo es más grave |
| 3. Carriles estables si la hermana puede apartarse al menos **medio carril (14 px)** en sus dos extremos; si no, ese canal se reparte centrado como antes | **sin defectos nuevos** (vuelve a la geometría de HEAD) | **460/500** estables; en 40 pares (anclas flotantes pegadas a una esquina) la primera se mueve como hoy | la captura, por arriba/abajo, 2–3 hermanas y U: estables |

Con umbral de carril entero (28 px) la opción 3 no sirve: el lado e/w de una caja de 70 px solo da 25 px, y volvería al reparto simétrico en los casos más comunes.

**Recomendación: opción 3.** Sigue tu orden de prioridades (evitar solapes y cruces va antes que la estabilidad) y deja estables todos los casos de tus capturas. Antes de aplicarla hace falta tu decisión, porque matiza la regla «una hermana no mueve la existente»: se mantendría **cuando el lado tiene sitio para medio carril**.

**Pendiente tras la decisión:**
- `fluyo-018-25-browser.cjs`: la captura (U en 700/300), estabilidad al añadir y borrar, mover nodos, el vídeo, Present, Viewer y SVG.
- Mutaciones de P1, P2 y A.
- `DECISIONS.md` 190 (reescrita) y 194–195, más `ARCHITECTURE.md`.
- Regresión dirigida y las capturas de QA.

## 22. Opción 3 modificada: estabilidad cuando cabe, recolocación mínima cuando no (IMPLEMENTADO)

**Regla del owner (14-10-2026), implementada:**
1. Ninguna conexión atraviesa nodos, ni genera muñones o retrocesos; se evitan cruces y solapes.
2. La existente se mantiene estable cuando hay sitio para separar la hermana.
3. Si no lo hay, el conjunto se reajusta de forma determinista y con el **movimiento mínimo**, sin volver al abanico simétrico por defecto.

**Implementación** (`laneLayout`, decisión 194). Candidatas:
- **ESTABLE**: la primera en 0 y las demás alternando ±g, con el mayor g ≤ 28 que cabe en los dos lados y nunca menor que 14; también en espejo.
- **RECOLOCADA**: el mismo orden con g = 14, corrido lo mínimo para que quepan todas.

Gana la de menos defectos (penetración en **cualquier** nodo de la página, retroceso, diagonal, cruce entre hermanas); a igualdad, la estable, el menor movimiento y la orientación +. El abanico recortado de antes queda solo como último recurso, cuando no cabe ninguna candidata (no ocurre en el barrido ni en el corpus). Port idéntico en `svg.ts`.

**Primera versión descartada:** la recolocación usaba la separación máxima que cabía (20 px) y movía la existente 10 px. Se cambió a la separación razonable (14 px), que es el mínimo necesario: **4–5 px**.

### 22.1 Resultados del barrido (500 pares; 750 páginas)

| | Resultado |
|---|---|
| Pares estables (la existente no se mueve ni una centésima) | **490 / 500** (HEAD: 0 / 500) |
| Pares recolocados | **10** |
| Cuáles | `null/null` con B en diagonal: (800,300), (0,300), (0,700), (800,700) y (807,300), × {mismo sentido, opuesto} |
| Por qué | el hueco común de los dos lados mide 18–20 px; la hermana no cabe a 14 px sin mover la existente |
| Desplazamiento de la existente | **máx. 5 px, medio 4,2 px**, a lo largo del lado. El test comprueba que es exactamente `14 − sitio disponible`: el mínimo necesario |
| Muñones / retrocesos / diagonales / penetraciones | **0 / 0 / 0 / 0** en las 1250 aristas |
| Cruces entre hermanas | 76 → 56. **Nunca peor que HEAD caso a caso**: los 2 cruces de 4 recolocados ya estaban en HEAD (es la Z de dos flotantes) |
| Trazo compartido | Ningún par separado pasa a compartir. Total 126 732 → 107 583 px. Donde ya se compartía, como mucho +28 px |
| Las 40 del umbral anterior (medio carril con reparto simétrico) | ya no aplican: con la regla nueva son 10, con 4–5 px en vez de un reparto simétrico |

### 22.2 Casos revisados

| Caso | Resultado |
|---|---|
| La captura original (gesto real con el puerto) | La directa **idéntica** con y sin la U, centrada en y = 300; U limpia `700,265 700,237 300,237 300,265` |
| A→B + B→A arriba / abajo | Directa quieta; U limpias por el pasillo exterior (237 / 363) |
| Varias hermanas (3 directas, U arriba + U abajo, dos U) | La primera quieta; 0 cruces y 0 trazo compartido; U anidadas |
| Documento con orden ≠ id | El carril 0 es de la de id menor |
| Nodo ajeno en el carril preferido | La hermana se abre al otro lado, sin atravesarlo; la directa quieta |
| Borrar la U (Supr) y Deshacer | La directa no se mueve; todo vuelve exactamente igual |
| Mover nodos | B 40 px abajo: rutas válidas; devolverlo: exactamente igual que antes |
| Vídeo (39 px de hueco a 219 %) | Ruta `390,300 410,300 429,300` (recta, sin ida y vuelta) y **1 punto** de flujo |
| Huecos 120/72/60/56/39/20/5, horizontal y vertical, sola, par, opuesto y Z | 0 retrocesos y 0 diagonales; con hueco ≥ 56, idéntica a HEAD |
| Puntos (normal e inverso, 3 y 6 configurados) | 0 retrocesos visibles; ≥ 24 px entre puntos; con sitio, el mismo número que hoy |
| Present | Las mismas rutas que el editor |
| Viewer (enlace compartido) | Las mismas rutas que el editor |
| SVG del editor | La directa sale en y = 300; la vuelta no retrocede; punta perpendicular y pegada al borde |
| Paridad Fluyo ↔ MCP | Vértice a vértice en **812 páginas** (1343 aristas) |
| `ingesta-v2` | Cambian solo e11/e12 (el par), sin defectos nuevos en los chequeos A–F |
| `rag-chatbot` | e6 **no se mueve** y e7 se abre al otro lado: pasa 6 px a la derecha del icono «Usuario» sin atravesarlo; sin defectos nuevos. El tramo horizontal de e7 corre a 9 px del de «respuesta» durante unos 76 px (en HEAD, 10 px durante 56) |
| Corpus publicado | 0 de 61 aristas cambian |
| Golden 018.16 | Solo la arista 10 (el muñón de R1); las dos copias idénticas |

### 22.3 Pruebas (dirigidas)

| Suite | Resultado | Tiempo |
|---|---|---|
| `test/fluyo-018-25.test.cjs` | **16/16** | 2,9 s |
| `test/fluyo-018-25-browser.cjs` d1440 + m390 (incluye `editor-inline.html` 51/0) | **44 ✔ · 0 ✘** | 10,1 s |
| `test/fluyo-018-16.test.cjs` | 20/20 | 0,2 s |
| `test/fluyo-018-16-browser.cjs` `ONLY=d1440 FAST=1` | 114 ✔ · 0 ✘ | 22 s |
| `test/fluyo-018-24.test.cjs` | 9/10: #9 es su alcance contra HEAD (`render.js`) y pasa al commitear | 0,5 s |
| `test/fluyo-018-25-mutations.cjs` | **22/22 detectadas** (16 vm + 6 Chrome) | 128 s (algo por encima del objetivo de 2 min) |
| fluyo-mcp `REQUIRE_FLUYO=1 npm test` | **694/694** | 8 s |
| fluyo-mcp `npm test` sin fluyo/ | 661 · 0 fallos · 27 omitidos por diseño | 11 s |
| `check:config` / `check:kernel` | Sincronizados (el kernel no cambia); sin fluyo/, «omitido» | — |

Mutaciones nuevas:
- **P1:** carriles simétricos, agrupar por par, orden por documento, ignorar defectos, recolocación no mínima.
- **P2:** pasillos sin acortar, canal sin acotar.
- **Puntos:** sin tope, separación 12, el lienzo sin `flowDotCount`.

La de «ignorar defectos» sobrevivía hasta que se añadió el caso del nodo ajeno en el carril.

### 22.4 Archivos

**fluyo:**
- `js/geometry.js`: `trackKey`, `trackSiblings`, `parallelLane`, `laneLayout`, `laneRange`, `laneShift`, `laneCrossings`, `siblingCount`, `orthoRoute` (U, P2) y `edgePoints`; más D9 (`handleRoute`, `edgeHandlePts`, `routeIsStraight`).
- `js/render.js`: `flowDotCount` y `FLOW_DOT_SEP`, más las barras de D9.
- `js/interaction.js`: D9.
- `sw.js`: v83. 36 tests históricos: solo `CACHE`.
- `test/fixtures/fluyo-018-16-conexiones-svg.json`.
- `test/fluyo-018-25{.test,-browser,-mutations}.cjs`.
- `.ai/DECISIONS.md` (190 reescrita, 191–196), `.ai/ARCHITECTURE.md` y esta tarea.

**fluyo-mcp:**
- `src/svg.ts`: port idéntico.
- `test/fixtures/fluyo-018-16-conexiones-svg.json`.
- `test/fluyo-017-3-qa.test.ts` (D5).
- `test/visual-regression.test.ts`: paridad en 812 páginas.
- `test/fluyo-018-25.test.ts`.

### 22.5 Cambios en geometrías existentes (lo que cambia respecto a HEAD)

- **Aristas solas:** solo las 2 U con pasillos desiguales que tenían muñón (R1) y las conexiones entre caras a menos de 56 px (P2, antes retrocedían).
- **Pares:**
  - en 490 de 500, la primera queda como si estuviera sola (antes se apartaba ±14) y la hermana se aparta hacia fuera;
  - en los 10 restantes, recolocación de 4–5 px;
  - en la captura, la directa vuelve al centro (+14/−14 → 0).
- **Corpus:** 0 cambios. Golden 018.16: solo la arista 10.
- **Fixtures del MCP:** los pares de `ingesta-v2` y `rag-chatbot`, sin defectos nuevos.
- **No cambió ningún golden fuera de lo esperado.**

**Estado: READY FOR COMMIT.** Sin commit, push ni deploy. Dos commits del owner, uno por repo, y su despliegue manual del MCP.

---

# FLUYO-018.25 — READY FOR COMMIT

Sin commit, sin push, sin deploy.
