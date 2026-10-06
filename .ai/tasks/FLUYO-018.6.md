# FLUYO-018.6 — Siguiente slice de 018.x: auditoría y plan

Estado: **READY FOR COMMIT** (implementado según este plan; ver «Resultado» al final). Sin commit, push ni deploy. No se toca 018.5.
Fecha: 6 de octubre de 2026.
Owner/agente actual: libre.

> Repo público: nada de este documento es confidencial.
> Fuentes revisadas: `FLUYO-018.md` (§14, §18–§21, §22), `018.2/.3/.4/.5`, `DECISIONS.md` 83–96, `ARCHITECTURE.md`; código de `fluyo/js` (`model.js`, `story-authoring.js`, `state.js`, `ui.js`, `selection.js`, `render.js`) y `fluyo-mcp/src` (`server.ts`, `authoring.ts`, `diagram.ts`, `layout.ts`, `kernel.ts`, `templates.ts`); `git status` de ambos repos.

## 0. Recomendación (léela primero)

**Implementar en 018.6 dos cosas pequeñas y sin tocar el editor:**

1. **Corregir dos defectos de entrada de 018.5** (en `story-authoring.js`):
   - `fill:"none"` («Sin relleno») **se rechaza** en `create_node`/`update_node` pese a ser un valor válido del documento, del selector del editor, del render y de `create_diagram` (**regresión de 018.5, verificada**).
   - Validar los colores de **conexión** (`lineColor`, `dotColor`) con la misma regla HEX (**deuda registrada en 018.5, verificada**: hoy se persiste `"not-a-color"`).
2. **Añadir `propose_layout`**: una herramienta MCP **de solo lectura** que, dada una página, calcula posiciones con el auto-layout por capas que ya existe (`layout.ts`) y devuelve lotes `author_document` listos para aplicar.

**Por qué esto y no otra cosa:**

- Es el mayor hueco de **experiencia del agente** que queda: `author_document` exige `x,y` en cada nodo y no hay forma de pedir una disposición; solo `create_diagram` (que nace v3, fuera del kernel) y `edit_diagram.relayout` (legacy) calculan posiciones. Un agente que autora con el camino moderno tiene que adivinar coordenadas o apilar nodos en (0,0) (spike 3: 12 nodos en (0,0) → lote válido, diagrama ilegible).
- **No modifica producto**: ni `index.html`, ni `js/*.js` servidos, ni `sw.js` (`story-authoring.js` solo lo carga MCP: no es asset del Service Worker). No hay bump de `CACHE`, ni QA de navegador, ni cambio de UX.
- **Cero reglas nuevas del documento**: el layout es «ayuda del agente» (decisión de 018 §9/§14: no hay motor geométrico en el kernel y no debe haber un tercero). Se aplica con `update_node` ya existente, validado por `FluyoIntegrity`, con `baseRevision` y todo-o-nada.
- Desbloquea lo que viene: enrutar `create_diagram`/`create_from_template` por el kernel necesita el layout como servicio reutilizable, y retirar `edit_diagram` necesita un sustituto de `relayout`.

Riesgo: **bajo** (solo-lectura + una regla de entrada). Coste público conocido: la tool nº 13 cambia el contrato «12 tools» (tests, README, `verify-deploy.sh`).

## 1. Pendientes: ¿siguen abiertos? (verificado contra el código)

| Pendiente | Estado | Evidencia | Veredicto |
|---|---|---|---|
| `delete_page` | **Abierto** | Solo existe en `ui.js:471-476` (`pages.splice` + `confirm`). Sin función de dominio. `doc.cur=Math.min(cur, len-1)` no corrige `cur` si se borra una página anterior a la activa; el Undo es por página (`snapPage`), así que **borrar una página no se puede deshacer**; borra sus Historias sin avisar de ellas (el `confirm` solo nombra la página). Las páginas no tienen id: borrar desplaza los `pageIndex` siguientes (en un lote, las operaciones posteriores cambiarían de significado). | **Aplazar.** Necesita decisión de producto del editor antes de MCP (Undo, aviso de Historias, `cur`). |
| `duplicate_*` | **Abierto** | Editor: `dupSel` = `copySel`+`pasteClip` (acoplado a `clip`/`selN`); duplicar conexión no existe como gesto; `duplicate_page` no existe. `duplicate_story`/`duplicate_step` ya existen. | **Aplazar.** Poco valor para un agente (puede crear nodos); extraer el dominio de `selection.js` es trabajo propio. |
| Orden Z | **Abierto** | El orden Z es la posición en `nodes[]` y forma parte de la revisión (018 §17). Editor: `bringToFront` (`selection.js:127`). Sin dominio ni operación MCP. | **Aplazar.** Bajo valor; tocaría editor + `model.js` (bump de SW). Encaja con un slice que ya toque el editor. |
| Auto-layout como herramienta de lectura | **Abierto** | `layout.ts` solo se usa en `create_diagram`, `create_from_template` y `edit_diagram.relayout`. `author_document` no tiene ninguna ayuda de posicionado. | **018.6** |
| `set_theme` | **Abierto** | `ui.js:382` (`doc.theme=…` inline). Solo MCP: `edit_diagram.set_theme` (legacy). | **Aplazar.** Necesita dominio + wrapper en editor (sw bump). Prerrequisito de retirar `edit_diagram`. |
| `image` por MCP | **Abierto, pero ya no bloqueado** | La lectura funciona (spike 3: `describe_document` con un nodo `image` OK, tras `4655058`; nota de 018.2 obsoleta). Crear exige un canal de bytes (límite HTTP 1 MB, validación `safe-svg`, tamaños). | **Aplazar** (sin diseño ni demanda). Actualizar la nota de 018.2 en el próximo toque de docs. |
| Enrutar `create_diagram`/`create_from_template` por el kernel | **Abierto** | `diagram.ts` sigue produciendo v3 + `meta`, con `buildNode`/`buildEdge` propios (los 5 `null` de 018 §12.2). Escribe ajustes de documento (`theme`, `grid`, `speed`, `dots`, `stagger`, `single`, `font`, `customBg`) que `author_document` no puede escribir. | **Aplazar a 018.7+.** Requiere fábrica de documento en el kernel, decisión v3→v5 y decisión sobre nombres de color. |
| Retirar/congelar `edit_diagram` | **Parcial** | Ya **congelado y documentado como legacy** (decisión 96, descripción de la tool). La *retirada* depende de `set_theme`, de un sustituto de `relayout` y de política de deprecación pública. | **Aplazar.** Último de la cadena. |
| Validación de colores de conexión | **Abierto** | Spike 1: `create_connection` con `lineColor:"not-a-color"`, `dotColor:"red"` → aceptado y persistido. El SVG lo escapa bien (no hay inyección: `stroke="red&quot; onload=…"` inerte) pero el lienzo con un color inválido **ignora la asignación** y conserva el `strokeStyle` anterior (color equivocado silencioso, distinto del SVG). | **018.6** (parte B). |
| Deuda registrada: `alert`/`confirm` nativos provisionales | Abierto | Pendiente de rediseño visual. | Fuera (producto/diseño). |
| Deuda registrada: tests obsoletos `fluyo-011-browser` (3) | Abierto | Fallan igual en HEAD (018.4, «Fallos conocidos»). | Fuera (higiene de tests, slice propio). |

## 2. Dependencias entre pendientes

```text
colores/fill (B) ──────────────── independiente
propose_layout (A) ─┬─> create_diagram/template por el kernel ─┐
                    └─> sustituto de relayout ─────────────────┤
set_theme (editor+dominio) ────────────────────────────────────┼─> retirar edit_diagram
fábrica de documento en kernel (+ decisión v3→v5, colores) ─────┘
delete_page ─ decisión de producto del editor (Undo/aviso/cur) ─ independiente
orden Z, duplicate_* ─ tocan editor + model.js ─ independientes entre sí
image por MCP ─ independiente (diseño de canal de bytes)
```

- **A** no depende de nada; **B** tampoco, pero cuanto antes mejor porque todo flujo de agente crea conexiones y formas huecas.
- Todo lo que toca el editor (`set_theme`, orden Z, `duplicate_*`, `delete_page`) comparte coste de release (bump de `CACHE`, QA de navegador, mutaciones): conviene agruparlo, no mezclarlo con un slice solo-MCP.

## 3. Deuda de 018.5: ¿hay algo que resolver antes?

Estado de release comprobado: ambos repos con árbol limpio y sincronizados con `origin/main` (`fluyo` 4587b5c, `fluyo-mcp` 8e8622e); `check:kernel` y `check:config` OK (ejecutados). No se ejecutó la batería completa (no pedido).

| # | Hallazgo | Gravedad | Acción |
|---|---|---|---|
| D1 | **`fill:"none"` rechazado** por la regla HEX de 018.5 (`NODE_COLOR_FIELDS` incluye `fill`, `story-authoring.js:370-376`). Es valor legítimo («Sin relleno», `ui.js:163`; `render.js:83`; `create_diagram` lo admitía). Spike 4: `create_node {fill:"none"}` → `INVALID_FIELD`. Un agente no puede crear ni restaurar una forma hueca, y `update_node` a `"none"` también falla. Solo `fill` admite `"none"` (`textBg` solo `null`). | **Media (regresión)** | **Resolver en 018.6.** |
| D2 | Colores de conexión sin validar (conocida). | Baja–media | **Resolver en 018.6.** |
| D3 | `create_page` sin tope de páginas (018 §11 lo listó: «sin tope»; 018.5 no lo trató ni lo registró como pendiente). | Baja | Registrar; no resolver ahora (sin daño observado). |
| D4 | `sizeMin=10` en autoría frente a 40×30 de redimensionado del editor. Declarado en 018.5; coherente con «regla de entrada». | Informativa | Ninguna. |
| D5 | `list_colors` dice que se aceptan nombres en `color`/`lineColor`/`dotColor`; en `author_document` solo HEX (decisión 94). Puede inducir a error al agente. | Baja | Aclarar el texto de `list_colors` (los nombres valen en las tools legacy; la salida ya incluye el HEX). |
| D6 | Contratos fijados a «12 tools» en tests/README/`verify-deploy.sh`. | Mecánica | Se actualizan al añadir la 13ª. |

Nada de 018.5 obliga a parar: D1 y D2 se resuelven dentro de 018.6 (parte B) **antes** de la parte A.

## 4. Alcance de 018.6

### Incluye
- **B1** `fill:"none"` aceptado como valor válido (solo `fill`; create y update) en la regla de entrada de nodo.
- **B2** Validación HEX de `lineColor` y `dotColor` en `create_connection` y `update_connection` (solo claves escritas; `null` permitido; valor antiguo inválido no se revalida).
- **B3** Aclarar `list_colors` y el README.
- **A** Tool `propose_layout` (solo lectura) + servicio `layoutPage` en MCP reutilizable.
- Tests, mutaciones y actualización de contratos de la tool nº 13.

### No incluye (queda fuera, con motivo)
`delete_page`, `duplicate_*`, orden Z, `set_theme`, `image` por MCP, enrutar `create_diagram`/`create_from_template`, retirar `edit_diagram`, tope de páginas (D3), nombres de color en autoría, layout en el kernel o en el editor, cualquier cambio en `index.html`/`js/*.js` servidos/`sw.js`, layout incremental («colocar solo nodos nuevos»), opciones de dirección/espaciado, rediseño de `confirm`/`alert`, tests obsoletos de `fluyo-011-browser`.

## 5. Contrato y arquitectura

### 5.1 Parte B (en `fluyo/js/story-authoring.js`; afecta a `kernelId`)
- `nodeInputRules`: para `fill`, además de HEX y `null`, acepta la cadena exacta `"none"`. El resto de campos de color, igual que en 018.5.
- Nueva regla de conexión: `EDGE_COLOR_FIELDS = ["lineColor","dotColor"]`, mismo `HEX_COLOR`, `null` válido (= color del tema). Se aplica a las claves de la **spec** al crear y del **parche** al actualizar (patrón de decisión 94: no retroactiva).
- Error: `INVALID_FIELD {field}` (mismo código y forma que los de nodo). Sin cambios en `FluyoIntegrity`, en la carga de documentos ni en `LIMITS`.
- `fluyo-mcp`: `npm run sync:kernel`. Sin cambios de schema (`ConnectionSpec` ya admite `Text(40).nullable()`).
- **No cambia ningún asset servido**: se verifica con diff (solo `story-authoring.js` y `.ai/`) y comprobando que `CACHE` sigue en `fluyo-static-v63`.

### 5.2 Parte A: `propose_layout` (solo `fluyo-mcp`)
Tool nº 13, `annotations: TOOL_PURA` (read-only, idempotente), sin estado.

**Entrada**
```jsonc
{ "document": <documento>,            // como describe_document (v1–v5)
  "pageIndex"?: 0,                    // por defecto, doc.cur
  "clearWaypoints"?: true }           // por defecto true
```

**Salida (`ok:true`)**
```jsonc
{ "ok": true, "revision": "sha256:…",           // la de este documento (= describe_document)
  "pageIndex": 0, "algorithm": "layered-lr-v1",
  "summary": { "nodes": 12, "moved": 11, "unchanged": 1, "layers": 12,
               "bounds": { "before": {…}, "after": {…} } },
  "positions": [ { "id": 1, "x": 200, "y": 720, "from": { "x": 0, "y": 0 } } ],
  "connectionsWithWaypoints": [16],             // las que tenían ruta manual
  "batches": [ { "baseRevision": "sha256:…", "operations": [ /* update_node {x,y}, update_connection {waypoints:[]} */ ] } ],
  "warnings": [] }
```
- `batches` se pasan tal cual a `author_document` **en orden**. Normalmente es 1 lote. Si hay más de 200 operaciones (`MAX_OPERATIONS`) se parte en lotes de ≤200; el `baseRevision` del lote *k+1* es el `resultRevision` del lote *k*, calculado **dentro de la propia tool** ejecutando `authorDocument` de verdad sobre una copia (los lotes no son atómicos entre sí; cada uno sí lo es y deja el documento válido, porque solo se mueven nodos).
- Solo emite operaciones para nodos cuya posición cambia; `update_connection {waypoints:[]}` solo si `clearWaypoints` y la conexión tiene waypoints. Con `clearWaypoints:false` los waypoints se conservan y se listan en `warnings` (quedarán desalineados: ya lo avisa `affects.connectionsWithWaypoints`).
- Errores (sin trazas): `DOCUMENT_UNREADABLE`, `PAGE_NOT_FOUND`, `LAYOUT_EXCEEDS_LIMITS {limit:"coordMax", field, actual}` (el layout **no recorta** en silencio: spike 2 muestra que 300 nodos en cadena con etiquetas de 120 caracteres llegan a x≈303 745 > 100 000). Página sin nodos: `ok:true`, `batches:[]`.
- Garantías: no modifica el documento; determinista (mismo documento → mismas posiciones y lotes); la geometría la decide `layeredLayout` (el mismo que `create_diagram`/`relayout`); el kernel sigue siendo quien valida al aplicar (`author_document`). No se añade ninguna regla al documento.

**Arquitectura**
- `layout.ts` no cambia de algoritmo. Se extrae `layoutPage(page) → Map<id,{x,y}>` (adaptación página→entrada del algoritmo), que reutilizan `propose_layout` y `edit_diagram.relayout` (sin cambiar su resultado: test de paridad) y, más adelante, `create_diagram` por kernel.
- La tool lee el documento con el kernel (`normalizeWith`, `revisionOf`) igual que `describe_document`; los límites salen de `FluyoAuthoring.LIMITS` (no se duplican).
- Sin geometría en el kernel ni en el editor (cierra la regla de 018 §9: no hay tercer motor).

### 5.3 Decisiones a registrar (propuestas para `DECISIONS.md` 97–98)
- **97.** `fill:"none"` es valor válido de entrada; los colores de conexión siguen la regla HEX de entrada no retroactiva.
- **98.** El auto-layout es una herramienta de lectura (`propose_layout`) que propone coordenadas; aplicarlas es `update_node` bajo B2/baseRevision. No hay operación `relayout` en `author_document` ni layout en el dominio.

## 6. Plan de implementación y pruebas (para la sesión de implementación)

1. **B** (primero): reglas en `story-authoring.js` → `sync:kernel`. Tests: `fill:"none"` en create/update; HEX/`null`/inválido en `lineColor`/`dotColor` (create y update); valor antiguo inválido no impide editar otra clave; `INVALID_FIELD.field`; todo-o-nada; paridad con `create_diagram` para una forma hueca. Mutaciones (`mutate-018-6`): quitar `"none"`, quitar la regla de conexión, validar también claves ausentes, hacerla retroactiva.
2. **A**: `layoutPage` + `propose_layout`. Tests: paridad de posiciones con `edit_diagram.relayout` y con `create_diagram(autoLayout)`; aplicar `batches` con `author_document` → `ok`, posiciones == propuesta, `run_story` con Trace idéntico antes y después; determinismo; entrada congelada; idempotencia (aplicar y volver a proponer → `moved:0`, o documentar por qué no); ciclos, nodos aislados, forma `text`, conexiones paralelas, auto-lazo antiguo, documento v3 de `create_diagram`, página vacía; waypoints con/sin `clearWaypoints`; >200 operaciones → lotes encadenados válidos; `LAYOUT_EXCEEDS_LIMITS`; `PAGE_NOT_FOUND`; sin trazas. Mutaciones: ignorar `clearWaypoints`, `baseRevision` sin encadenar, recortar en silencio, emitir ops para nodos sin cambio.
3. **Contrato de 13 tools**: `tools.test.ts`, `http.test.ts` (las «doce»), `fluyo-017-3`/`018-5` (cuentan 12), `contract.test.ts` (anotaciones/títulos), `README.md`, `scripts/verify-deploy.sh` (lista de nombres), versión del servidor si procede.
4. **Verificación final mínima**: `npm test` y `REQUIRE_FLUYO=1 npm test`, `check:kernel`, `check:config`, `build`; en `fluyo` solo los tests que fijan `story-authoring` (018-2/018-3/018-5) y las mutaciones afectadas; stdio real (`node dist/index.js`): `tools/list` = 13, `describe_document` → `propose_layout` → `author_document` de punta a punta. **Sin QA de navegador** (el editor no cambia); comprobar por diff que `js/*.js` servidos, `index.html` y `sw.js` no cambian.
5. Docs: `ARCHITECTURE.md`, `DECISIONS.md` (97–98), este archivo (Resultado), nota de 018.2 sobre `image` (la lectura ya funciona).

### Criterios de aceptación
- [ ] `create_node`/`update_node` aceptan `fill:"none"`; `lineColor`/`dotColor` inválidos se rechazan con `INVALID_FIELD`; documentos antiguos no se invalidan.
- [ ] `propose_layout` no modifica el documento y sus lotes, aplicados con `author_document`, producen exactamente las posiciones propuestas y el mismo Trace de Historias.
- [ ] Paridad de posiciones con `create_diagram`/`relayout` demostrada por test.
- [ ] `sw.js` (`CACHE` v63) y los assets servidos intactos; `check:kernel`/`check:config` OK.
- [ ] Contratos y README con 13 tools.

## 7. Riesgos y preguntas abiertas

- **Tool nº 13 = cambio de contrato público** (aditivo; clientes existentes no se rompen). Alternativa descartada: parametrizar `describe_document` (mezcla lectura descriptiva con cálculo).
- **Calidad del layout**: es el Sugiyama simplificado de siempre (README: «no para grafos muy ramificados»). `propose_layout` lo declara en `algorithm`; no se promete mejor calidad. Mejorarlo sería otro slice, con el mismo contrato.
- **Reubica toda la página** (ancla en x=200, y centrada en el lienzo, igual que `create_diagram`). Dejar fijos nodos existentes o colocar solo los nuevos queda fuera; si se pide, es una opción nueva del mismo contrato (`fixedIds`), no un cambio.
- **Lotes encadenados no atómicos entre sí** (solo si >200 ops, es decir, páginas de ~200+ nodos; el tope de autoría es 300). Aceptable porque cada lote deja un documento válido; documentado.
- **Pregunta para el responsable:** ¿se acepta incluir B (D1+D2) en el mismo slice que A? Recomendado (mismo archivo del kernel, mismo ciclo de `sync:kernel`, sin QA de navegador); si se prefiere, B puede salir como 018.5.1 aparte.

## 8. Hoja de ruta tentativa posterior (no comprometida)

- **018.7 — Dominio de documento en el editor**: `set_theme` (+ orden Z si se quiere) con wrappers del editor; bump de `CACHE`, QA de navegador. Decisión de producto previa si se incluye `delete_page`.
- **018.8 — Enrutar `create_diagram`/`create_from_template` por el kernel**: fábrica de documento en el kernel, salida v5, decisión sobre nombres de color y sobre el `meta` de v3.
- **018.9 — Deprecación/retirada de `edit_diagram`** (política pública de versión).
- `delete_page`, `duplicate_*`, `image`, tope de páginas: slices propios por demanda.

## Anexo — Pruebas exploratorias (mínimas, fuera del repo, descartadas)

Scripts en el directorio temporal de la sesión, contra `fluyo-mcp/dist` (solo lectura, sin recompilar). No se ejecutó la batería de tests de los repos.

| # | Hipótesis | Resultado |
|---|---|---|
| 1 | Se puede partir de un documento v5 en blanco escrito a mano | `describe_document` lo acepta (`valid:true`). Ninguna tool lo ofrece; `create_diagram` exige ≥1 nodo. |
| 2 | Los colores de conexión se validan | **No**: `lineColor:"not-a-color"`, `dotColor:"red"` aceptados y persistidos. `lineColor:'red" onload=…'` y `dotColor:'</svg><script>…'` salen **escapados** en el SVG (sin inyección). Canvas: un color inválido se ignora (`render.js:789`). |
| 3 | `layeredLayout` sirve como lectura sobre un documento de `author_document` | 12 nodos en (0,0) + 11 conexiones (una con waypoints) → posiciones; `update_node` ×12 en `dryRun`: `ok`, `resultRevision` idéntico en dos ejecuciones (determinista); `affects.connectionsWithWaypoints` lista la conexión con ruta manual. |
| 4 | El layout respeta `coordMax` | **No siempre**: 300 nodos en cadena sin etiquetas → x≈95 880; con etiquetas de 120 caracteres → ≈303 745; con 500 → ≈1 071 816. Hay que **rechazar**, no recortar. 300 nodos planos: y de 140 a 20 155, 0 ms; 300×600 denso: 2 ms. |
| 5 | `fill:"none"` en `author_document` | **Rechazado** (`INVALID_FIELD fill`); `#ff0000` aceptado. Regresión de 018.5 (D1). |
| 6 | Documento con nodo `image` legible por MCP | `describe_document` OK (13 nodos). Crear sigue sin ofrecerse. |
| 7 | Sincronía de kernel/config tras 018.5 | `check:kernel` y `check:config` OK. |

## Resultado (implementación)

Estado: **READY FOR COMMIT** en `fluyo` y `fluyo-mcp` (sin commit, push ni deploy). Decisiones 97–98 en `DECISIONS.md`. Solo cambia `story-authoring.js` en Fluyo (no es asset del editor): `index.html`, `js/*.js` servidos y `sw.js` (`CACHE` v63) **intactos** (verificado con `git status`); por eso no hay QA de navegador.

### Contrato final de `propose_layout` (tool nº 13, solo lectura)
Entrada: `{document, pageIndex?, clearWaypoints? = true, baseRevision?}`. **Opera sobre UNA página** (`pageIndex`; por defecto `doc.cur`); las demás no se tocan (para otra página, aplicar y volver a llamar con el documento resultante). Salida `ok:true`: `{readOnly, revision, pageIndex, pageName, algorithm:"layered-lr-v1", clearWaypoints, summary:{nodes,moved,unchanged,layers,operations,batches,bounds:{before,after}}, positions:[{id,x,y,from,moved}], connectionsWithWaypoints, waypointsCleared, batches:[{baseRevision,resultRevision,operations}], finalRevision, warnings}`. Errores (`ok:false`, `isError`): `LAYOUT_EXCEEDS_LIMITS {limit, limitName, limitValue, actual, field, nodeId, pageIndex, nodes, offendingNodes, required:{maxAbsX,maxAbsY}}`, `PAGE_NOT_FOUND {pageIndex,pages}`, `REVISION_MISMATCH {expected,actual}`, `DOCUMENT_UNREADABLE`, `LAYOUT_NOT_APPLICABLE` (defensivo). Aviso: `WAYPOINTS_KEPT`.
- Operaciones: `update_node {x,y}` solo de los nodos que cambian; `update_connection {waypoints:[]}` solo de las conexiones con waypoints cuyos extremos se mueven (y solo si `clearWaypoints`). Lotes de ≤200 operaciones, aplicados de verdad en memoria para encadenar `baseRevision` = `resultRevision` anterior.
- Garantías: no devuelve ni modifica documento, sin estado, determinista (respuesta idéntica byte a byte, también con otro orden de claves en la entrada), idempotente (tras aplicar, `moved:0`); motor único (`layoutPage` → `layeredLayout`; `edit_diagram.relayout` usa la misma función y los resultados coinciden con `create_diagram(autoLayout)`); límites del kernel (`FluyoAuthoring.LIMITS`), sin recortar; un documento antiguo que ya excede los topes de conteo se ordena igualmente.

### Archivos
Fluyo: `js/story-authoring.js`; tests `test/fluyo-018-6.test.cjs` (8), `test/fluyo-018-6-mutations.cjs` (17), `test/fixtures/fluyo-018-6-golden.json`; `test/fluyo-017-3-mutations.cjs` (ancla A2 obsoleta desde 018.5, actualizada); docs `.ai/ARCHITECTURE.md`, `.ai/DECISIONS.md`, este archivo.
fluyo-mcp: `src/propose-layout.ts` (nuevo), `src/layout.ts` (`layoutPage`), `src/diagram.ts` (relayout usa `layoutPage`), `src/server.ts` (tool nº 13; descripción de `list_colors`), `src/generated/kernel-sources.ts` (`sync:kernel`), `README.md`, `scripts/verify-deploy.sh` (13 tools), `scripts/mutate-018-6.ts` (nuevo), `scripts/mutate-017-3.ts` (ancla obsoleta desde el fix de web-globals, actualizada); tests `test/fluyo-018-6.test.ts` (23), `test/fixtures/stories/fluyo-018-6-golden.json`, y contratos 12→13 en `tools.test.ts`, `http.test.ts` (+caso de paridad HTTP), `fluyo-017-3.test.ts`, `fluyo-018-5.test.ts` (tope de tools/list 60 000 → 62 000).

### QA
- Fluyo: `node --test test/*.test.cjs` **880/880** (872 + 8); `node --check` de `js/*.js`, `sw.js`, `test/*.cjs` OK. Mutaciones: 018-6 **17/17**, 018-5 44/44, 018-4 18/18, 018-3 60/60, 018-2 26/26, 018-1 29/29, 017-3 31/31, 016 28/28.
- MCP: `npm test` y `REQUIRE_FLUYO=1 npm test` **533/533** (509 + 24: 23 nuevos + 1 caso HTTP); `build`, `check:kernel`, `check:config` OK. Mutaciones: 018-6 **38/38**, 018-5 37/37, 018-3 36/36, 018-2 23/23, 017-3 30/30.
- stdio real (`node dist/index.js`): `tools/list` = 13 con `propose_layout` de solo lectura; build de un diagrama con `fill:"none"` y colores → color inválido `INVALID_FIELD` → `propose_layout` determinista → lote aplicado (`resultRevision` = `finalRevision`) → segunda propuesta `moved:0`.
- Deuda de herramientas encontrada y resuelta: dos anclas de mutación obsoletas **previas** a 018.6 (`fluyo-017-3-mutations.cjs` A2 desde 018.5; `mutate-017-3.ts` desde el fix de web-globals del kernel). Nota: la de 018.2 sobre `image` («DOCUMENT_UNREADABLE») está obsoleta (arreglado en `4655058`).
- No se ejecutaron los tests de navegador (el editor no cambia) ni `verify-deploy.sh` (requiere despliegue; solo se comprobó `bash -n`).
