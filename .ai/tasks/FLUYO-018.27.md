# FLUYO-018.27 — Tamaño configurable de las puntas (`arrowSize`)

Estado: **READY FOR COMMIT** (dos commits del owner, uno por repo; el despliegue manual del MCP también es del owner). Base: `a165df4` (018.25) en fluyo y `8cced15` en fluyo-mcp. `CACHE` v84. Sin commit, push ni deploy.
Fecha: 14 de octubre de 2026.
Owner/agente actual: libre.

> Repo público: solo contenido técnico del proyecto open source.
> Contexto leído: `AGENTS.md`, `.ai/ARCHITECTURE.md`, `.ai/DECISIONS.md` (hasta la 196) y `FLUYO-018.25.md` §19 (auditoría previa de las puntas). Código: `js/geometry.js` (`edgeStroke`), `js/model.js` (autoría y normalización), `js/render.js`, `js/export.js`, `js/ui.js` (segmentados de 018.23), `index.html`; en el MCP `src/svg.ts`, `src/model.ts`, `src/authoring.ts`, `src/stories.ts` (`describe_document`), `scripts/sync-kernel.ts`.

## 1. Causa: cómo se calculaba el tamaño (auditoría, sin cambios)

| Pregunta | Respuesta |
|---|---|
| Dónde vive el tamaño fijo | `geometry.js`, sección «Trazo de una conexión» (018.16): `EDGE_HEAD_LEN=11`, `EDGE_HEAD_HALF=4`, `EDGE_HEAD_NOTCH=2.8`, usadas por `edgeHeadSegs` (polígono de la aguja) y por el recorte `trim(…, EDGE_GAP + LEN − NOTCH)` de `edgeStroke`. Port carácter a carácter en `src/svg.ts` del MCP. |
| startArrow / endArrow | La MISMA aguja, orientada con `strokeDir` desde cada extremo; la punta a `EDGE_GAP=3` del ancla. |
| Rectas, ortogonales, U | Todas pasan por `edgeStroke(e, edgePoints(e))`: una sola geometría de dibujo. No existen conexiones curvas (`route` ∈ {straight, ortho}); las esquinas redondeadas son del trazo, no de la punta. |
| SVG del editor, Present, Viewer, export | `render.js` (lienzo: editor, Present y Viewer), `export.js` (SVG) y `editor-scenarios.js` (vista previa) rellenan `stroke.heads` tal cual; ninguno escala aparte. Sin `<marker>` desde 018.16. |
| MCP | `svg.ts` idéntico (la paridad de `visual-regression.test.ts` lo compara vértice a vértice). `describe_document` no lista propiedades visuales (ni `dashed` ni puntas). |
| ¿Depende del zoom? | No: unidades de mundo, escala con el diagrama como la línea (a zoom 1, 11 × 8 px de pantalla). |
| ¿Del grosor, la escala del lienzo, la longitud, el tipo de punta? | No, no, no (salvo que `trim` nunca deja el tramo bajo 1 px) y no. |
| Diferencia Fluyo ↔ MCP | Ninguna. |

Medido en px de mundo (recta horizontal de 100): aguja 11 × 8, muesca a 8,2 de la punta, punta en 97 (3 del ancla), línea hasta 88,8.

## 2. Diseño final de `arrowSize`

- **Dato**: `edge.arrowSize`, opcional, número. Ausente = 1 = la aguja de siempre. **No se migra ningún documento**: la carga no rellena la clave; `null` la quita; un número se acota en [1, 2]; un valor no numérico en la carga vale 1 (como `speedFac`), en un parche se rechaza (`invalid_document`/`arrowSize`).
- **Dibujo** (`geometry.js` y `svg.ts`): `edgeHeadSegs(tip, u, size)` escala largo, medio ancho y muesca con el mismo factor desde la punta; `edgeStroke` recorta la línea hasta la muesca escalada (`cut = EDGE_GAP + (LEN − NOTCH)·k`). La punta sigue a `EDGE_GAP` del ancla; `EDGE_W`, `edgePoints`, anclas, etiquetas y puntos de flujo no cambian. `edgeArrowSize(e)` vuelve a acotar en [1, 2] por si llega un documento sin normalizar.
- **Kernel** (`model.js`): `arrowSize` en `CONNECTION_SPEC_KEYS`, `CONNECTION_UPDATE_KEYS`, `UPDATE_NUMBERS` (+ `UPDATE_NULLABLE_NUMBERS = {dots, arrowSize}`), normalización en `normalizeProjectEdge`; `updateConnectionIn` borra la clave cuando la normalización la quita (no queda `undefined`).
- **UI**: «Tamaño de flecha» [1×] [1,5×] [2×], en Dirección justo bajo Puntas, segmentado sobre el control nativo `#arrowSizeSel` (patrón 018.23). Un cambio = `pushUndo` + `editEdge`; elegir el valor actual no escribe; con Puntas = Ninguna se oculta; es fila de conexión (`edgeRows`). Sin CSS nuevo, sin grupo nuevo.
- **MCP**: sin API nueva. `ConnectionSpec`/`ConnectionPatch` (`create_connection`, `update_connection`) y `EdgeSpec` (`create_diagram`, acotado en el schema a [1, 2]) llevan `arrowSize`; el kernel resincronizado lo valida. `describe_document`, `svg.ts` (port) y la paridad con cada tamaño.

Decisiones 197–199.

## 3. Valores elegidos y px resultantes

Se mantienen los tres valores pedidos: **1 · 1,5 · 2**. Medido sobre `edgeStroke` y en píxeles del lienzo real (Chrome):

| k | aguja (largo × ancho) | muesca desde la punta | línea termina a (del ancla) | tramo recto delante de la punta (pasillo de 28) |
|---|---|---|---|---|
| ausente / 1 | 11 × 8 | 8,2 | 11,2 | 8,8 |
| 1,5 | 16,5 × 12 | 12,3 | 15,3 | 6,35 |
| 2 | 22 × 16 | 16,4 | 19,4 | 4,3 |

Por qué 2 es el tope: en el pasillo de 28 px de una ortogonal la esquina se acorta con el tramo recortado (k = min(8, l₂/2)), así que a 2× aún quedan 4,3 px rectos y la base de la punta no se monta en la curva (018.25 §19 estimaba 0,6 con esquina fija; medido, 4,3). Por encima de ~2,07 la base entraría en la curva. Visualmente, 2× en una U se lee bien (captura `d1440-2x.png`): la base queda a 3 px del canal perpendicular.

**Limitación conocida (caso D, conexión muy corta):** con Ambas puntas y hueco de 30 px, a 2× las dos agujas (3 + 22 cada una) se solapan y forman un lazo; la ruta y los anclajes no cambian. Es inherente al tamaño elegido por el usuario (hueco < 2·(3 + 11·k)); no se reduce automáticamente porque 1,5× y 2× deben ser siempre proporcionales y predecibles.

## 4. Archivos modificados

**fluyo**
- `js/geometry.js` — sección del trazo: `ARROW_SIZE_MIN/MAX`, `edgeArrowSize`, `edgeHeadSegs(tip,u,size)`, `edgeStroke` (`size`, `cut`). Todo lo anterior (anclas, rutas, carriles, barras) y lo posterior (puerto, código, cilindro, SVG) byte a byte como HEAD.
- `js/model.js` — las seis ediciones de §2 (claves, `UPDATE_NUMBERS`/`UPDATE_NULLABLE_NUMBERS`, borrado de la clave, normalización).
- `js/ui.js` — `syncArrowSizeSeg`, `segOnSelect("arrowSizeSeg","arrowSizeSel")`, `#arrowSizeSel.onchange`, `rowArrowSize` en `edgeRows`; `syncArrowSeg` llama a `syncArrowSizeSeg`.
- `index.html` — `#rowArrowSize` (segmentado + select nativo) bajo Puntas.
- `sw.js` — `CACHE` v84.
- `test/fluyo-018-27.test.cjs`, `test/fluyo-018-27-browser.cjs`, `test/fluyo-018-27-mutations.cjs` (nuevos); las aserciones de `CACHE` de los tests anteriores pasan a v84 (como en cada slice).
- `.ai/ARCHITECTURE.md`, `.ai/DECISIONS.md` (197–199), esta tarea.

Sin cambios: `render.js`, `export.js`, `editor-scenarios.js`, `interaction.js`, `selection.js`, `state.js`, `config.js`, CSS, Historias, Story Clock, Playback, Present, Viewer (`s/index.html`, `viewer.js`), Share (`share-url.js`, `link-codec.js`, `deeplink.js`), `docs/`.

**fluyo-mcp**
- `src/svg.ts` — port: `ARROW_SIZE_MIN/MAX`, `edgeArrowSize`, `edgeHeadSegs(tip,u,size)`, `edgeStroke`.
- `src/model.ts` — `FluyoEdgeSchema.arrowSize` (number | null, opcional); `EdgeSpec.arrowSize` (`create_diagram`, min 1 max 2).
- `src/authoring.ts` — `ConnectionSpec.arrowSize` (y, por `omit`, `ConnectionPatch`).
- `src/generated/kernel-sources.ts` — `npm run sync:kernel` (model.js nuevo).
- `test/fluyo-018-27.test.ts` (nuevo), `test/visual-regression.test.ts` (paridad con `arrowSize` 1 / 1,5 / 2 / fuera de rango, también en los casos límite), `scripts/mutate-018-27.ts` (nuevo), `README.md` (campos de una conexión).

Sin cambios: `describe_document` (`stories.ts`), `diagram.ts`, `server.ts`, `templates.ts`, fixtures y goldens.

## 5. Cambios de modelo/kernel

Ver §2. Formato: clave opcional nueva; `version` no cambia. Compatibilidad comprobada en ambos sentidos: un documento antiguo abre y se dibuja byte a byte igual (corpus publicado 61/61; `projectFromProjectData` no añade la clave); un documento 018.27 abierto con el `model.js` de HEAD conserva la clave tal cual (passthrough) y la ignora.

## 6. Cambios MCP

Ver §2 y §4. No hace falta operación nueva ni cambio en `describe`. `create_diagram` acota ya en el schema (3 → rechazo); `author_document` deja la acotación al kernel (7 → 2, 0,25 → 1, `"2"` → `INVALID_FIELD`/`arrowSize`, `null` → quita la clave).

## 7. Resultados de tests y 8. tiempos reales

| Suite | Resultado | Tiempo |
|---|---|---|
| `node --test test/fluyo-018-27.test.cjs` (vm, 15 tests) | 15/15 | ~1,0 s |
| `node test/fluyo-018-27-browser.cjs` (Chrome real, d1440 + m390, 32 comprobaciones) | 32/32 | 4,6 s |
| `node test/fluyo-018-27-mutations.cjs` (19 U + 4 B) | 23/23 detectadas | 26 s (U) + 27 s (B) |
| MCP `node --test dist-test/test/fluyo-018-27.test.js` + paridad | 7 + 48 = 55/55 | 1,0 s |
| MCP `npm test` completo (con fluyo/ al lado) | 701/701 | 7,5 s |
| MCP `node scripts/mutate-018-27.ts` (3 app + 9 mcp) | 12/12 detectadas | 56 s |
| Regresión dirigida: `fluyo-018-25-browser.cjs` d1440 | 41/41 | 9,1 s |
| Regresión dirigida: `fluyo-018-23-browser.cjs` d1440 y m390 (panel) | 49/49 · m390 sin fallos | 6,4 s + m390 |
| Unitarias vecinas: 018-16 (20), 018-3 (35), 018-22, 018-21, 018-23, 018-24, 018-25 | pasan salvo los chequeos de alcance contra HEAD (abajo) | ~2 s cada una |

**Fallos esperados antes del commit** (comparan el árbol con HEAD y vuelven a pasar al commitear): 018-21 #18, 018-23 #1, 018-24 #9, 018-25 #16 («alcance: model.js idéntico a HEAD»). Aparte, 9 tests de `fluyo-018-25.test.cjs` (1, 3–6, 8, 10, 11, 13) comparan con el `geometry.js` de HEAD esperando el estado anterior a 018.25; como HEAD ya es 018.25, fallan también en un árbol limpio. Con `FLUYO_GIT_ROOT=<clon en e22734d>` pasan 15/16 (solo el #16 de alcance). No es de este slice; queda anotado.

Mapa T1–T14: T1/T13 (corpus idéntico a HEAD; carga sin migrar; HEAD passthrough), T2 (1 = ausente), T3/T4 (recta y corpus: cada vértice = tip + k·(v₁ − tip)), T5/T6/T7 (inicio, fin, ambas), T8 (Chrome: zoom 2 → doble de píxeles; estático: sin factor de pantalla), T9 (cortas y P2), T10 (Chrome: Undo/Redo exactos con selección), T11 (Chrome: Present y Share → Viewer dibujan la punta grande), T12 (paridad MCP con cada tamaño + `fluyo-018-27.test.ts`), T14 (clonar/duplicar/eliminar en vm y en Chrome).

## 9. Mutaciones

fluyo (`test/fluyo-018-27-mutations.cjs`): U0 CACHE no sube · U1 ignora arrowSize · U2 escala invertida · U3 solo largo · U4 solo ancho · U5 muesca sin escalar · U6 la punta se aleja del ancla · U7 línea sin recortar · U8 inicio ignora el tamaño · U9 el tamaño cambia la ruta · U10/U11 crear/editar rechazan la clave · U12 la carga la pierde · U13 la carga migra · U14 sin acotar · U15 string aceptado · U16 pegar/duplicar la pierden · U17/B1 panel sin Undo · U18 el manejador escribe sin cambio · B3 refreshPanel no sincroniza · B4 el lienzo compensa el zoom · B5 edgeStroke ignora arrowSize (lienzo, SVG, Present, Viewer). 23/23 detectadas.

fluyo-mcp (`scripts/mutate-018-27.ts`): divergencias de la app (ignora, solo ancho, acota en [1, 3]) y del MCP (ignora, invierte, solo largo, solo ancho, punta alejada, sin recorte, inicio sin tamaño, `ConnectionSpec` sin la clave, `EdgeSpec` sin la clave). 12/12 detectadas.

## 10. Chrome dirigido

`test/fluyo-018-27-browser.cjs` (4,6 s): escena con los casos A (recta), B (par bidireccional), C (U n/n), D (hueco 30 px, ambas puntas), E (vertical: Ninguna/Inicio/Fin/Ambas), todas en rojo y sin puntos; para 1× / 1,5× / 2× mide en píxeles del lienzo el ancho de la base (8·k ± 1,5) y que el rojo termina a 3 px del ancla (ni flota ni entra en el nodo); `edgePoints` y nodos no cambian; zoom 2 → el doble de píxeles; panel (posición, valores, Undo por clic, clic inerte en el valor actual, teclado flechas/Inicio, Undo/Redo con selección, ocultar sin puntas); SVG del editor (10 puntas explícitas, 22 × 16, sin `<marker>`); eliminar/deshacer y duplicar; Present (mismo `edgeStroke`, dibujo grande); Share → Viewer (la clave llega y se dibuja grande); m390: toque en 2× = una entrada de Undo, botón de 44 × 44.

## 11. Capturas / QA

En el scratchpad de la sesión (`shots/`): `d1440-1x.png`, `d1440-1_5x.png`, `d1440-2x.png` (escena completa), `d1440-*-zoom.png` (detalle de B y D), `d1440-viewer-2x.png`, `m390-panel.png`. Lo visto: la punta termina siempre a 3 px del borde; en la U a 2× la base queda a 3 px del canal (apretado pero limpio); en la conexión de 30 px con Ambas a 2× las puntas se solapan (§3).

## 12. Compatibilidad con documentos antiguos

Confirmada: corpus publicado 61/61 aristas byte a byte iguales a HEAD; `projectFromProjectData` no añade la clave; deep link (`link-codec`) y JSON conservan la clave donde existe y no la inventan; `cloneStructureIn`/`duplicateNodesIn` la copian; eliminar no toca a las demás; Share → Viewer la lleva; el `model.js` de HEAD abre un documento 018.27 sin romperse.

## Próximo paso

Owner: revisar, commit en fluyo y en fluyo-mcp (el kernel generado va en el commit del MCP), desplegar el MCP a mano. No se continúa con otro slice.
