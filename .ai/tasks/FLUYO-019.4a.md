# FLUYO-019.4a — Aterrizaje por silueta con la piel «construido»

**Estado: READY FOR COMMIT** (19-10-2026). Implementado y validado sobre `22f82eb`, sin commit, push ni deploy. Se espera la autorización del owner.
**Base:** `22f82eb` (HEAD = origin/main; fluyo.space sirve CACHE v92, comprobado byte a byte en 10 archivos servidos).
**Origen:** reencuadre de `.ai/tasks/FLUYO-019.4.md`, que se escribió sobre `b534a97` (v87) y ha quedado desfasado (ver «Relación con 019.4»).
**Método:** Chrome real (Playwright `channel:"chrome"`, service worker bloqueado, repo servido en solo lectura) más `vm` sobre el corpus. El prototipo se inyectó en la página real sin tocar el repo.

## Objetivo

Con la piel activa (Present, Viewer, GIF/PNG/JPG y SVG del editor), toda conexión termina recta y con la punta junto al contorno **visible** de su destino, en las 10 formas del dominio. La pelota de «Una pelota por ruta» recorre exactamente la línea que se pinta. En plano no cambia nada.

## Por qué

`skinEdgeLanding` (019.1) mueve el último vértice (+4, −4) y el penúltimo lo acompaña, sin mirar la forma del destino. `skin.js` no ha cambiado desde `b534a97`, así que los defectos siguen en producción:

- **F2: el último tramo se inclina.** `orthoRoute` deja un muñón de 28 u colineal, así que el penúltimo vértice no es un giro y el tramo que lo precede se tuerce. En el corpus (8 ejemplos + `fluyo-019-2-skin`, `fluyo-018-16-conexiones` y los 13 casos de D6; 98 conexiones) aterrizan 21 y **se inclinan 20**, entre 2,4° y 18°, en 7 de los 8 ejemplos.
- **F3: aterriza donde no hay cara.** De esas 21, **14** terminan en cilindro, icono, rombo, círculo o `anim`. La punta queda flotando unas 7 u por encima del contorno (en plano son 3) y desplazada 4 u. Reproducido en exportación y en Present real a zoom 2,5.
- **F13: la pelota única se separa de la línea.** `drawFlowBalls` → `pathGeometry` usa `edgePoints` (ruta lógica) y la línea se pinta aterrizada. Distancia medida: **hasta 4,95 u**. Los tokens de Historia y el modo puntos ya usan los puntos pintados.
- Además, en el bloque la punta queda parcialmente bajo la tapa: 187 frente a 202 px visibles en plano, en el caso sintético.

## Regla

### Aterrizaje por silueta (F2 + F3, C1 + C2)

La punta **retrocede por su propio último tramo** hasta salir de la **silueta visible** que la piel pinta para el destino. Desde ese punto, el trazo aplica el `EDGE_GAP` de siempre, así que la punta queda a 3 u del contorno que se ve, con la misma lógica de separación que en plano frente al contorno lógico.

- **Silueta** = las capas cerradas que pinta `skinNode(B)` (`top`, `side`, `front`, `body`, `cap`) más el glifo de un `icon`. No cuentan `contact` (trazo abierto), `led` ni `band` (va recortada al cuerpo).
- `t*` = la distancia, a lo largo de la semirrecta que sale del ancla hacia fuera por el último tramo, hasta salir de la silueta. Se encadenan las capas contiguas.
- **Solo se mueve el último vértice, y sobre su propia recta.** Ningún tramo puede inclinarse, el origen nunca se mueve y el anillo de salida tampoco.
- **No hay ninguna regla por forma.** Lo que distingue a cada forma ya está en `skinNode`. En las formas planas `skinNode` devuelve `null`, la silueta está vacía y `t* = 0`. En el cilindro el contorno visible coincide con el lógico y `t* = 0`.
- **Guardas:**
  - el último tramo debe llegar desde fuera de la caja lógica de B (una conexión de un hijo a su contenedor que sube por dentro no se toca);
  - si `t* > L − 1`, con `L` la longitud del último tramo, no se toca;
  - si `t* = 0`, se devuelven las mismas coordenadas (identidad bit a bit).
- No depende del lado (`inferSide` deja de hacer falta) ni de la dirección: también cubre una recta de dos puntos o diagonal que entre por la tapa. En los 8 ejemplos no hay ninguna. *(Corrección al implementar: los casos de `fluyo-019-d6-capas.json` tienen 5 rectas diagonales hacia una hoja, que ahora se paran en su silueta: 8√2 u.)*

Comportamiento resultante (medido; el icono con su tamaño por defecto):

| Forma | Norte | Este | Oeste | Sur |
|---|---|---|---|---|
| `rect` | retrocede 8 u (tapa) | retrocede 8 u (lateral) | = plano | = plano |
| `cylinder` | = plano | = plano | = plano | = plano |
| `icon` | = plano | se para en la peana (≈16 u) | 0,5 u (borde de la peana) | = plano |
| `circle`, `diamond`, `hex`, `text`, `code`, `image`, `anim` | = plano | = plano | = plano | = plano |

### Pelota única (F13)

La pelota sigue usando la distancia `s`, la longitud `L` y el camino más largo `D` **lógicos** (`pathGeometry` con `edgePoints`). Solo cambia la polilínea en la que se coloca: `pointAt(puntos pintados, s/L)`. Por construcción, el reloj (`f = t·speed`), la duración, el bucle del GIF, la opacidad (`nodeAlpha · flowBallFade(s, L)`), el número de pelotas y el dedupe del tramo compartido no cambian. Sin piel, o sin aterrizaje, los puntos pintados son los lógicos y el resultado es idéntico bit a bit.

## Alcance

### Incluye

- `js/skin.js`:
  - `skinEdgeLanding(pts, B)` pura con la regla de silueta;
  - un auxiliar puro `skinSilhouette(n)` (o equivalente) que obtiene las capas cerradas de `skinNode` sin cambiar `skinNode`; el golden de capas de 019.1 queda igual;
  - intersección exacta con los segmentos `L`, `Q` y `A`.
- `js/render.js`:
  - `drawEdge` llama con el destino;
  - `pathGeometry` guarda también los puntos pintados (`vis`) cuando `rs.skinOn`;
  - `drawFlowBalls(c, t, rs)` coloca la pelota con `pointAt(vis, s/L)`;
  - las dos llamadas de `render()` (lienzo y exportación) pasan `rs`.
- `js/export.js`: `renderConnectorToSVG` llama con el destino.
- `sw.js`: CACHE v92 → **v93**.
- Tests nuevos, goldens y fijaciones (ver «Pruebas»).
- `.ai/DECISIONS.md` (decisión 213) y `.ai/ARCHITECTURE.md` (líneas de `skinEdgeLanding` y «Conexiones» de la sección de la piel).

### No incluye

- **fluyo-mcp** (`src/skin.ts`, `svg.ts`): se portará en un slice aparte junto con la fase 2 de D6. Ver «Relación con el MCP».
- **Editor / 019.4b**: el lienzo del editor sigue plano (decisión 202 intacta).
- **D6**: el orden de capas (decisión 212) no se toca.
- **Etiquetas**: siguen la ruta lógica (`placeEdgeLabels`), como hoy.
- **`startArrow`**: la punta de inicio en el origen queda como hoy. No se midió.
- **Geometría de la peana del icono**: no se toca (C2).
- El modo puntos (código sin cambios), los tokens de Historia (ya usan los puntos pintados), `edgePoints`, `orthoRoute`, `laneLayout`, anclas, acierto, kernel, formato, Share, Viewer (más allá de pintar con el mismo `render()`) e interfaz.

## Decisiones tomadas (owner, 19-10-2026)

- **Reencuadre**: 019.4a = solo el aterrizaje. Fuera quedan D3 (contradice la decisión 212) y `skinZones` (D6 lo supera).
- **Solo fluyo**: el MCP queda fuera, con una brecha temporal declarada.
- **C1 — Bloques: aprobado.** La punta queda a 3 u del contorno visible de la tapa o del lateral, con la misma separación que en plano. Se acepta el cambio visual respecto a 019.1 (antes tocaba el borde trasero de la tapa, con el tramo inclinado y la punta en parte oculta).
- **C2 — Iconos: aprobado.** La punta respeta la silueta real del icono, peana incluida: si la peana corta el último tramo, la punta se para ahí. La peana no cambia en este slice.
- **F13: aprobado.** La pelota recorre exactamente la geometría visible de la conexión aterrizada y mantiene el reloj, la duración, el bucle y la opacidad.
- A registrar al implementar, como **decisión 213**, en `.ai/DECISIONS.md`: «Con la piel, la punta de una conexión retrocede por su último tramo hasta la silueta visible del destino (capas cerradas de `skinNode` + glifo); solo se mueve el último vértice; formas sin silueta = plano; la pelota única se coloca sobre los puntos pintados con `s`, `L` y `D` lógicos; MCP pendiente del port».

## Criterios de aceptación

1. **Plano idéntico**: sin la clave `skin`, el lienzo, Present, Viewer, GIF/PNG/JPG y SVG son byte a byte los de `22f82eb`, en el corpus completo, con documento y payload de share.
2. **0 tramos inclinados** con la piel en todo el corpus y en la matriz sintética (10 formas × n/e/w/s × muñón colineal / codo / ruta alineada / recta de dos puntos / con codos manuales).
3. **Solo cambia el último vértice**, y en la dirección de su propio tramo; el origen nunca cambia.
4. **Punta visible como en plano**: en la matriz sintética, los píxeles de la caja de la punta que cambian al omitir la conexión coinciden con los de plano (tolerancia de antialias por fijar en el test), con la piel, en el lienzo de exportación y en el SVG rasterizado.
5. **Formas sin silueta** (cilindro y las 7 planas, icono por el norte y el sur): los puntos pintados son exactamente los lógicos.
6. **Bloque**: la punta pintada queda a `EDGE_GAP` de la silueta (y = y0 − 8 por el norte, x = x1 + 8 por el este) con el ancla centrada. **Icono por el este**: la punta queda a `EDGE_GAP` del borde exterior de la peana.
7. **Guardas**: un último tramo que llega desde dentro de la caja lógica no se toca; con `t* > L − 1` tampoco.
8. **F13**: en un ciclo muestreado (≥ 240 instantes), la distancia de cada pelota visible a la línea pintada es ≤ 1e-9. `D`, la opacidad y el número de pelotas son idénticos a `22f82eb`, el bucle (t y t + 1/speed) también, y sin piel o sin aterrizaje la salida es idéntica bit a bit.
9. **Modo puntos**: idéntico a `22f82eb` en las conexiones sin aterrizaje; en las aterrizadas, los puntos están sobre la línea pintada y su número no cambia en el corpus.
10. Present del editor, Viewer (#d=) y su Present, a 1440 y a 390, en crema, claro y oscuro: 0 errores de página.
11. Rendimiento: un fotograma con la piel y 300 nodos cuesta ≤ 1 ms más que en `22f82eb` (mediana de rondas intercaladas en páginas limpias, el criterio de D6).

## Plan (con GO)

1. `skin.js`: `skinSilhouette` y `skinEdgeLanding(pts, B)` con intersección exacta, guardas e identidad cuando `t* = 0`.
2. `render.js`: llamada en `drawEdge`; `pathGeometry` con `vis`; `drawFlowBalls(c, t, rs)` y sus dos llamadas.
3. `export.js`: llamada en `renderConnectorToSVG`.
4. `sw.js` v93 y el literal de CACHE en los tests que lo comprueban (52 archivos con `fluyo-static-v92`).
5. Tests nuevos, goldens y fijaciones (abajo).
6. Regresión de navegador completa contra `22f82eb` (clon de la base en el scratchpad). Fallos previos conocidos: 011, 018-12, 018-19, 018-23, 018-5, 019-2 n.º 14 y 15, y 018-17 n.º 8. Hay que confirmar que fallan igual en la base.
7. Decisión 213, ARCHITECTURE y handoff. Parar en READY FOR COMMIT.

## Pruebas (previstas)

- **`test/fluyo-019-4a.test.cjs`** (vm):
  - tabla exacta forma × lado × tipo de ruta;
  - solo el último vértice cambia, en su dirección;
  - el origen nunca cambia;
  - identidad con `t* = 0`;
  - las dos guardas;
  - pureza;
  - corpus con 0 inclinaciones;
  - F13 con un contexto falso (pelotas, `D`, opacidad, número, bucle, plano y sin aterrizaje);
  - modo puntos;
  - alcance: kernel, `geometry.js`, `skinNode` y el golden de capas sin cambios.
- **`test/fluyo-019-4a-browser.cjs`** (Chrome real):
  - visibilidad de la punta por forma y lado frente a plano, en lienzo y SVG;
  - Present y Viewer reales;
  - bucle del GIF;
  - plano byte a byte frente a `22f82eb`;
  - con la piel, cambian solo las conexiones cuyo aterrizaje cambia;
  - rendimiento;
  - 0 errores.

  La base `22f82eb` debe reproducir F2, F3 y F13.
- **`test/fluyo-019-4a-mutations.cjs`**: mutaciones de la regla (no retroceder, mover el penúltimo, ignorar la guarda, mezclar `vis` en `L`/`D`, aterrizar sin silueta…).
- **Goldens que cambian**:
  - la sección `landing` de `test/fixtures/fluyo-019-1-skin.json`: hoy son pares (puntos, lado) sin destino, y pasan a llevar el nodo destino;
  - `test/fixtures/fluyo-019-2-skin-svg.json` (se regenera con `FLUYO_UPDATE_GOLDEN=1 node test/fluyo-019-2-browser.cjs`).

  No cambian: las capas de 019-1, `fluyo-019-3-colores.json`, `fluyo-019-5-tinte.json` ni el fixture de orden de D6. *(Corrección al implementar: el golden SVG de D6, `fluyo-019-d6-capas-svg.json`, sí cambia, porque las rectas diagonales de su caso D aterrizan. El MCP no tiene ese golden.)*
- **Fijaciones que hay que revisar**: las comparaciones «construido» del corpus contra commits antiguos en `fluyo-019-1(-browser)`, `fluyo-019-2(-browser)`, `fluyo-019-3-browser` (`1ee65ee`), `fluyo-019-5-browser` (`b534a97`) y `fluyo-019-d6-browser` («con la piel y sin contenedores, idéntico a `ce8e699`»). Las de plano no se tocan.
- **Test de fixtures compartidos** (`fluyo-019-2.test.cjs`, «byte a byte iguales en los dos repos»): con fluyo-mcp al lado, `fluyo-019-1-skin.json` y `fluyo-019-2-skin-svg.json` dejarán de coincidir. Se declara en el test, de forma explícita, que esos dos archivos divergen hasta el port del MCP, como hizo D6 con su brecha.

## Relación con 019.4

| Hallazgo de 019.4 | Estado en `22f82eb` |
|---|---|
| F2 aterrizaje inclinado | vivo → **este slice** |
| F3 aterrizaje sin cara | vivo → **este slice** (regla de silueta) |
| F4 zonas tapan hijos y conexiones | resuelto por D6 (decisión 212) |
| F5–F9 (marcas, acierto en caras, puerto, voz del textarea) | solo editor → 019.4b |
| F10, F11 | sin cambios (decisiones de diseño) |
| F12 `#rrggbbaa` en plano | resuelto por 019.5 (decisión 207) |
| D3 orden del documento | descartado: contradice la decisión 212 |
| `skinZones` | superado por `containmentPaintOrder` |
| F13 pelota única fuera de la línea | **nuevo**, en este slice |

## Relación con el MCP

- `src/svg.ts` llama a `skinEdgeLanding(pts, inferSide(...))` con la misma regla de 019.1. Tampoco tiene todavía las capas de D6 (fase 2 pendiente).
- Tras 4a, `export_diagram` con la piel diferirá del SVG del editor en las conexiones que aterrizan, además de en los contenedores. La brecha es temporal y queda declarada.
- El port (slice aparte) es literal: `skinSilhouette` y `skinEdgeLanding` sobre `skinNode`, que ya está portado, con los goldens nuevos como contrato. No cambian tools ni schema. El MCP no tiene pelota ni puntos de flujo, así que F13 no le afecta.

## Prototipo (fuera del repo, en el scratchpad de la sesión)

- `proto-landing.js` contiene tres variantes:
  1. trasladar todo el último tramo y solo bloques: descartada; en rutas alineadas movía el origen o dejaba la punta bajo la tapa;
  2. retroceder d/2 solo en bloques: descartada; con un icono por el este, la peana tapaba el 64 % de la punta;
  3. **silueta**: la propuesta.
- `audit-landing.cjs` / `audit-proto.cjs` (vm, corpus), `audit-chrome.cjs` / `audit-chrome2.cjs` (Chrome real) y capturas `shots3/` (`sheet-landing.png`: plano / HEAD / propuesta; Present a zoom 2,5).
- **Resultados de la variante 3:**
  - **Corpus:** 0 inclinaciones. 8 conexiones se retiran (7 bloques y 1 icono por el este), las 13 de F3 vuelven a la geometría de plano y 23 conexiones que entran a un icono por el oeste se retiran 0,5 u. El origen no se mueve en ninguna y el número de puntos no cambia.
  - **Chrome (42 casos sintéticos, entradas por n, e y w):** la punta se ve igual que en plano en todos. La entrada por el sur se verificó solo en vm: en las 10 formas, los puntos pintados son exactamente los lógicos.
  - **F13:** distancia de 4,95 → ≤ 1e-13. `D`, opacidad, número, bucle, plano y sin aterrizaje, idénticos.
  - **Modo puntos:** idéntico en las conexiones sin aterrizaje.
  - 0 errores de página.

## Riesgos

1. **Cambia lo que ya está en producción con la piel**: Present, Viewer, exportaciones y shares «construido» con conexiones que aterrizan (8 en el corpus). Es el cambio buscado (C1 y C2). El plano no cambia.
2. **Brecha con el MCP** hasta el port (riesgo 1 de la tabla de D6, ampliado).
3. **Intersección exacta con arcos y cuadráticas**: si se aproxima, el golden puede depender de la discretización. El test fija `t* = 0` exacto en el cilindro y valores exactos en el bloque.
4. **Sensibilidad del icono a su tamaño**: la peana queda justo a la altura del ancla lateral con el tamaño por defecto. Con otros tamaños, la punta por el este puede pararse en la peana o en el glifo. Es la regla aprobada (C2); si molesta, se ajusta la peana en otro slice.
5. **Rendimiento**: la silueta se calcula por conexión y fotograma, dos veces en modo pelota (`drawEdge` y `pathGeometry`). Se mide con el criterio 11; si hace falta, se cachea por fotograma.

## Implementación (19-10-2026)

- **`js/skin.js`**:
  - `skinSilhouette(n)`: las capas cerradas y rellenas de `skinNode`, con su `clip`;
  - `skinLineCuts`: cortes exactos de una recta con `L`, `Q` y `A`;
  - `skinLayerSpan`: intervalo de una capa convexa, recortado;
  - `skinEdgeLanding(pts, B)`: retroceso del último vértice hasta `t*`, con las guardas y la memo.

  `skinNode` y el resto de la piel no cambian.
- **`js/render.js`**:
  - `drawEdge` llama a `skinEdgeLanding(pts, B)`;
  - `drawFlowBalls(c, t, rs)` coloca la pelota con `pointAt(puntos pintados, s/seg.L)`;
  - las dos llamadas de `render()` pasan `rs`.

  `pathGeometry`, el bloque de los puntos y `flowBallFade` no cambian.
- **`js/export.js`**: `renderConnectorToSVG` llama a `skinEdgeLanding(pts, B)`. Es la misma regla que el lienzo.
- **`sw.js`**: CACHE v92 → **v93**.
- **Rendimiento**: 565 aterrizajes por fotograma costaban 9,4 ms en vm sin memo. Con la memo `SKIN_LANDING_T` cuestan 0,96 ms en vm y 0,35 ms en Chrome.
  - La clave es forma, caja, punta y punto anterior, con 4096 entradas como mucho; se vacía al llenarse.
  - **Criterio**: en Chrome, con 300 nodos y 565 conexiones, lo que añade 019.4a en cada fotograma (una llamada a `skinEdgeLanding` por conexión, con la memo caliente) cuesta **0,23–0,44 ms**. Es la mediana de 11 lotes, y ese es el valor que se comprueba (≤ 1 ms).
  - **Informativo**:
    - en frío, tras vaciar la memo (primer fotograma o cambio de todos los nodos): unos 5,6 ms una sola vez;
    - la diferencia entre fotogramas completos de unos 30 ms, con y sin aterrizaje en la misma página, dio +0,04 / +0,81 / +1,32 / +2,57 / +1,65 ms en pasadas distintas según la carga de la máquina, y frente a la base entre páginas entre −0,58 y +1,16 ms.

    Ese ruido hizo inestable el primer criterio (fotograma completo, misma página): falló dos veces por carga, con el coste aislado sin cambios. Por eso se sustituyó por la medida aislada.
- **Auditoría de la memo** (tests vm), comprobado:
  - el resultado es idéntico con la caché fría, caliente y desactivada, en la matriz y el corpus (930 casos) y en orden inverso;
  - cualquier propiedad del nodo fuera de la clave deja la silueta idéntica, y `x`, `y`, `w` y `h` sí la cambian;
  - no hay contaminación entre nodos ni documentos con los mismos ids;
  - nunca pasa de 4096 entradas, aunque se le pidan 12 288 casos distintos;
  - una llamada servida desde la caché no muta sus argumentos y devuelve una copia nueva (mutar esa copia no envenena la caché);
  - sin la piel no se consulta la memo;
  - la pelota, su reloj y su bucle son idénticos con la caché fría, caliente y desactivada.

  Además, U8, U9 y U14 (clave incompleta, caché sin límite) se detectan.

## Handoff

### Qué se hizo
Auditoría, prototipo y aprobación (C1, C2 y F13); después, implementación, tests y regresión completa contra `22f82eb` en clones limpios. El commit se simuló en un clon, sin tocar el repo. Hubo dos correcciones a la especificación al implementar: las rectas diagonales de D6 y el golden de D6 (ver «Regla» y «Pruebas»).

### Archivos modificados
- **Producto**: `js/skin.js`, `js/render.js`, `js/export.js`, `sw.js`.
- **Tests nuevos**: `test/fluyo-019-4a.test.cjs`, `test/fluyo-019-4a-browser.cjs`, `test/fluyo-019-4a-mutations.cjs` y `test/fluyo-019-4a-undo.cjs` (deshace 019.4a en los tests de alcance de slices anteriores).
- **Tests ajustados**:
  - `fluyo-019-1.test.cjs`: contrato y golden del aterrizaje;
  - `fluyo-019-2.test.cjs`: brecha declarada con el MCP;
  - `fluyo-019-2-browser.cjs`: smoke del service worker desde `22f82eb`, v92 → v93;
  - `fluyo-019-3`, `fluyo-019-d6`, `fluyo-019-flow-fade`, `fluyo-019-hit-test` y `fluyo-019-prskin`: alcance con `undo4a`;
  - `fluyo-019-d6-browser.cjs` y `fluyo-019-5-browser.cjs`: comparaciones de orden y tinte con el aterrizaje neutralizado en las dos páginas;
  - `fluyo-019-d6-mutations.cjs` y `fluyo-019-flow-fade-mutations.cjs`: dianas `(c,t,rs)` / `painted(seg)`.

  Otros 41 tests solo cambian el literal de CACHE (52 en total con el literal).
- **Fixtures**:
  - `fluyo-019-1-skin.json`: la sección `landing` pasa a `{in, out}` con el destino, 48 casos;
  - `fluyo-019-2-skin-svg.json`: cambian 14 líneas, las de las conexiones que aterrizan;
  - `fluyo-019-d6-capas-svg.json`: el caso D, con sus rectas diagonales.

  `fluyo-019-2-skin.fluyo.json`, el fixture compartido, **no cambia**.
- **Documentación**: `.ai/DECISIONS.md` (decisión 213), `.ai/ARCHITECTURE.md` (sección nueva y tres líneas de la piel) y esta tarea.
- **Excluidos**: `.ai/tasks/FLUYO-019.4.md`, que es de otra línea de trabajo, y todo `fluyo-mcp` (limpio, `81154f1`).

### Pruebas ejecutadas
- **Verificación final dirigida (cierre)**:
  - `fluyo-019-4a.test.cjs` **19/19**;
  - `fluyo-019-4a-browser.cjs` **21/21**;
  - `fluyo-019-4a-mutations.cjs` **21/21**;
  - `fluyo-019-d6-browser.cjs` **29/29**;
  - `fluyo-019-flow-fade-browser.cjs` **237/0**;
  - `fluyo-019-5-browser.cjs` **68/0**;
  - `fluyo-019-prskin-browser.cjs` **94/0**.
- **El cambio de `fluyo-019-5-browser.cjs`**:
  - Neutraliza el aterrizaje (copia de los puntos) **solo** en las dos páginas de la sección «corpus idéntico a `b534a97`».
  - Las medidas de `colorTint` en píxeles (editor, Present y Viewer en cuatro fondos), la paridad lienzo/SVG y el fixture usan otra página y no cambian.
  - Las comparaciones en plano no llaman al aterrizaje. En «construido» se siguen comparando capas, rellenos y tintes byte a byte.
  - Mismas 19 aserciones `check(`; 68/68.
- **vm**:
  - `fluyo-019-4a.test.cjs` **19/19**, en unos 3 s; incluye las 6 de auditoría de la memo y un oráculo de muestreo independiente;
  - `fluyo-019-1.test.cjs` 18/18;
  - las suites de piel, D6, FLOW-FADE, HIT-TEST y PRSKIN, 121/121.
  - **Suite completa con el commit simulado**: 1346 tests y 80 fallos, **los mismos 80 que `22f82eb`** (comparados por nombre). Ninguno nuevo.
- **Chrome**:
  - `fluyo-019-4a-browser.cjs` **21/21**, en el árbol y en el clon;
  - `fluyo-019-2-browser` 85/0;
  - `fluyo-019-d6-browser` 29/29;
  - `fluyo-019-5-browser` 68/0;
  - `fluyo-019-prskin-browser` 94/0.
- **Mutaciones**:
  - `fluyo-019-4a-mutations.cjs` **21/21** (14 vm + 7 Chrome, incluida U14);
  - `fluyo-019-d6-mutations.cjs`: **15/15**;
  - `fluyo-019-flow-fade-mutations.cjs`: 15/16 en la pasada completa. La que sobrevive, U0 («CACHE no sube, sigue v88»), sobrevive igual en `22f82eb`: escribe v90 y el alcance acepta «≥ v89». No tiene que ver con 019.4a. Con la diana corregida a v88 se detecta (16/16), pero esa corrección es de FLOW-FADE y **queda fuera de este commit**, sin commitear, para uno aparte.
- **Regresión de navegador completa** (45 suites, cada una en un clon con 019.4a commiteada y en un clon limpio de `22f82eb`, comparando código de salida y líneas ✘):
  - **35 en verde**.
  - **10 que ya fallaban en la base, con las mismas líneas ✘**:
    - 018-12, 018-19, 018-23 y 018-5;
    - 011, qa-share-hash, scenario-qa, share, share-post-qa y share-realistic-size: necesitan el paquete `playwright` completo y aquí solo hay `playwright-core`.
  - **0 regresiones**. La 019-5 fallaba por una fijación histórica del corpus «construido» contra `b534a97`. Se corrigió neutralizando el aterrizaje en las dos páginas y da 68/0 en el clon.
  - PRSKIN falló una vez **en la base** y dio 94/0 al repetirla: es inestable en la base, no en el árbol.

### Riesgos residuales
1. **Cambia la salida «construido» en producción** para las conexiones que aterrizan, a propósito (C1, C2): Present, Viewer, PNG/GIF/JPG, SVG y shares. El plano es idéntico a `22f82eb`.
2. **Brecha con el MCP** hasta el port: `export_diagram` conserva el aterrizaje anterior y sus fixtures son los de `22f82eb`. El port debería ir junto con la fase 2 de D6.
3. **Icono por e/w**: con el tamaño de serie, la peana queda a la altura del ancla lateral. Por el este la punta se para en la peana (16 u del glifo); por el oeste roza (0,52 u, en 23 conexiones del corpus). Es la regla aprobada (C2).
4. **Memo**: estado interno acotado (4096) y transparente (equivalencia probada). El primer fotograma tras vaciarla, o tras mover todos los nodos, recalcula: unos 5,6 ms con 565 conexiones, una vez. Si en el futuro `skinNode` dependiera de otra propiedad del nodo, la clave tendría que crecer; el test de «clave completa» lo detectaría.
5. Rectas diagonales que entran por una tapa: ahora también aterrizan. En los ejemplos no hay ninguna; en el fixture de D6, sí.
6. `startArrow` en el origen y las etiquetas siguen como hoy: fuera de alcance.
7. Desviación de esta sesión: un `sed` de normalización de finales de línea pasó por `FLUYO-019.4.md`. Su contenido es byte a byte el mismo (0 CR antes y después; lo escribió la herramienta Write, en LF), pero cambió su fecha de modificación.

### Diff final (frente a `22f82eb`)
- **Producto (4)**: `js/skin.js`, `js/render.js`, `js/export.js`, `sw.js` (CACHE v92 → v93). Intactos: `interaction.js`, `geometry.js`, `ui.js`, `viewer.js`, `editor-runtime.js`, `model.js`, `index.html`, `s/index.html` y CSS.
- **Tests**:
  - 4 nuevos (`fluyo-019-4a.test.cjs`, `-browser.cjs`, `-mutations.cjs`, `-undo.cjs`);
  - 57 modificados: 12 con cambios intencionados (los de «Archivos modificados» más `fluyo-019-5-browser.cjs`) y 45 solo con el literal de CACHE.
- **Fixtures (3)**: `fluyo-019-1-skin.json` (solo la sección `landing`; `nodes`, `themes` y `extent` iguales a `22f82eb`), `fluyo-019-2-skin-svg.json` y `fluyo-019-d6-capas-svg.json`.
- **Documentación (3)**: `.ai/DECISIONS.md`, `.ai/ARCHITECTURE.md` y `.ai/tasks/FLUYO-019.4a.md`.
- **Fuera**: la corrección de la diana U0 en `test/fluyo-019-flow-fade-mutations.cjs` (v90 → v88). Es de FLOW-FADE: el archivo entra en el commit con los cambios de 019.4a (literal de CACHE y diana `painted(seg)`), pero esa línea se queda sin stage para un commit aparte. `.ai/tasks/FLUYO-019.4.md` (otra sesión, sin seguimiento, no se incluye) y `fluyo-mcp` (limpio, `81154f1` = origin/main; sus copias de los fixtures, iguales a las de `22f82eb`).
- **Finales de línea**: el código y los tests están en LF. `ARCHITECTURE.md` y `DECISIONS.md` conservan el CRLF que ya tenían en la copia de trabajo; el índice es LF y git los normaliza al commitear.

### Estado actual
**READY FOR COMMIT.** Sin commit, push ni deploy.

### Próximo paso concreto
Con la autorización del owner: un commit en fluyo con los archivos de «Archivos modificados», **excluyendo `.ai/tasks/FLUYO-019.4.md`**. Después, si se pide, push (el despliegue en fluyo.space es automático) y comprobar que se sirve CACHE v93. El port al MCP va en un slice aparte.
