# FLUYO-018.2 — MCP: crear nodos y conexiones

Estado: **HECHO** (sin commit, sin push, sin Cloud Run). Solo `create_node` y `create_connection`; sin update/delete, sin tocar `edit_diagram`, editor, Viewer, Present ni Share. `sw.js` NO se tocó (el bump de 018.x se publica al release).

## 1. Contrato

Dos operaciones nuevas de `author_document`, ambas `scope: "page"` (no hay scope nuevo), con `pageIndex`:

```jsonc
{ "op":"create_node", "scope":"page", "pageIndex":0, "ref":"cliente",
  "spec": { "shape":"rect", "x":200, "y":300, "w":180, "h":70, "label":"Cliente" } }

{ "op":"create_connection", "scope":"page", "pageIndex":0, "ref":"pago",
  "source": {"ref":"cliente"}, "target": {"id":12},
  "spec": { "label":"Pago", "route":"ortho", "fromSide":"e", "toSide":"w" } }   // spec opcional
```

- `spec` = campos del documento (`w`/`h`, no `width`/`height`; colores en hex tal cual). El nodo exige `shape`, `x`, `y`; el resto toma los defaults del editor. `spec.id` opcional (id explícito). `ref`, `source` y `target` van en la operación, **no** en `spec` (`INVALID_OPERATION`).
- `shape`: las 10 del documento salvo `image` (necesita bytes; igual que `create_diagram`). Ver §9.
- `source`/`target`: `{ref}` (algo creado antes en el lote, **en la misma página**) o `{id}` (elemento existente). Exactamente una forma.

## 2. Dónde vive cada cosa (sin segunda implementación)

| Capa | Qué decide |
|---|---|
| `model.js` (`createNodeIn`/`createConnectionIn`, 018.1) | shape, campos, ids, source/target existentes, auto-lazo, normalización, defaults de geometría, `duplicate_ref` |
| `FluyoAuthoring` (`js/story-authoring.js`, kernel) | forma de la operación, resolución de refs del lote (por página), traducción de errores del dominio a códigos de authoring, `changes`/`refs` |
| MCP (`src/authoring.ts`) | schema zod (con topes), `baseRevision`/`resultRevision`, dryRun, forma de la respuesta |

Nota: la resolución de refs vive en `FluyoAuthoring` (donde ya vivían las de Historia/Step/EventType y que comparten editor-tests y MCP), no en TypeScript ni en `model.js`. MCP no calcula geometría ni crea registros.

## 3. Refs

- `ref` es del lote: no se persiste (test: el JSON del documento no contiene la ref). Un `Map` ref→id **por página y por tipo** (`nodes`/`edges`) se pasa como `context.refs` al dominio, que rechaza la repetida (`duplicate_ref` → `DUPLICATE_REF`) y registra la nueva. Disponible inmediatamente tras crear.
- Páginas: `cliente` en la página 0 y en la 1 es válido; una ref de otra página no se resuelve (`UNKNOWN_REF`, «es de OTRA página»). Nodo y conexión pueden llamarse igual (tipos distintos).
- Respuesta: `refs: [{ref, type:"node"|"connection", pageIndex, id}]` (lista, no objeto, porque la misma ref puede repetirse en páginas distintas). Solo nodos/conexiones; las refs de Historia/Step/EventType siguen en `changes`.
- `changes[]`: `{operation, scope, operationIndex, pageIndex, entityKind:"node"|"connection", entityId, created:true, ref?, …}` + nodo: `shape,label,x,y,w,h`; conexión: `source,target`; `affects:{stories:[]}`.

## 4. Atomicidad, revisión, dryRun

Sin cambios de semántica: copia → lote → validación final (`FluyoIntegrity`) → o todo o nada; el original no se modifica (probado con entrada congelada/comparada). `baseRevision` distinta → `REVISION_MISMATCH` sin tocar nada; `resultRevision` determinista (mismo lote + mismo documento = misma revisión). `dryRun` usa el mismo camino: mismos `changes`, `refs` y `resultRevision`, sin `document`.

## 5. Límites (política)

018 §19.1 no fijaba valores. Política conservadora, sin cambiar límites globales:
- 200 operaciones por lote (existente: zod + `MAX_OPERATIONS`) → como mucho 200 entidades por llamada; se rechaza antes de ejecutar nada.
- Topes de forma en el schema MCP (se rechazan antes de entrar al kernel): `label` ≤ 500, `font` ≤ 120, colores ≤ 40, `waypoints` ≤ 100 por conexión, `keywords` ≤ 200. Son reglas de autoría, no del dominio (el dominio sigue aceptando cualquier longitud).
- 1 MB por petición HTTP (existente); motor: 10 000 nodos/conexiones por página (`guard_exceeded`, ya detectado por la validación final).
- `tools/list` crece ≈ 2 KB por operación nueva: el tope del test pasó de 45 000 a 50 000 caracteres.
- No se añaden topes de coordenadas, nodos por página ni conexiones por nodo (decisión pendiente 7 de 018 §21: se decidirá con la edición).

## 6. Errores (estructurados, con `operationIndex`/`operation`)

`PAGE_NOT_FOUND`, `UNKNOWN_REF`, `DUPLICATE_REF`, `SOURCE_NOT_FOUND`, `TARGET_NOT_FOUND`, `SELF_LOOP`, `DUPLICATE_ID`, `INVALID_FIELD` (con `field`: forma, tipos, campos desconocidos, ruta/lados inválidos…), `INVALID_OPERATION` (spec ausente, ref en spec, extremo mal formado), `SCOPE_MISMATCH`, `REVISION_MISMATCH`. Nunca TypeError ni traza. Un valor fuera del schema (p. ej. `shape` inventada) lo rechaza el SDK con su mensaje de validación (comportamiento existente de todas las tools).

## 7. Paridad

Fixture de QA de 018.1 (Cliente, Comercio, Banco; Cliente→Comercio, Comercio→Banco ortho, Banco→Cliente discontinua). El editor real (`newNode`/`newEdge` de `state.js`, en `vm`) y `FluyoAuthoring` producen documentos `deepStrictEqual` y, en Fluyo, también idénticos como texto (mismo orden de claves). El golden (`test/fixtures/fluyo-018-2-golden.json`, regenerable con `UPDATE_GOLDEN=1`) se comparte con fluyo-mcp (`test/fixtures/stories/`), cuyo test comprueba que el resultado de `author_document` es `deepStrictEqual` al golden y que ambas copias coinciden.

## 8. Kernel

`npm run sync:kernel` → `kernel-sources.ts` contiene `createNodeIn`/`createConnectionIn`/`create_node`/`create_connection`; `check:kernel` OK. Deriva probada sobre una copia de `fluyo/js` (modificada → falla; restaurada → pasa; también con deriva solo en `story-authoring.js`).

## 9. Desviaciones y hallazgos

1. **Ubicación de las refs**: en `FluyoAuthoring` (ver §2), no «en la capa MCP» de TypeScript.
2. **`w`/`h`** en vez de `width`/`height` (los campos del documento; el ejemplo del encargo era conceptual).
3. **`refs` es una lista**, no un objeto (misma ref en dos páginas).
4. **`image` no se ofrece** (convención de `create_diagram`). Hallazgo previo, no corregido: el contexto `vm` de MCP (`src/kernel.ts`) no define `atob`/`btoa`/`TextEncoder`/`TextDecoder`, así que un documento con nodos `image` ya hoy se lee como `DOCUMENT_UNREADABLE` en `author_document`. Fuera de alcance; conviene un slice propio.
5. **`check:config` estaba roto desde 018.1** (comprobaba que `newNode()` en `state.js` leyera `DEFAULT_SIZES`, y ahora lo lee `createNodeIn` en `model.js`). Corregido en `scripts/sync-config.ts`.
6. Tests de 017.2 que fijaban «no existe ninguna operación de nodo/conexión» y «14 operaciones» se actualizaron al contrato nuevo (solo `create_*`; 16 operaciones; los `delete_*`/`update_*`/`add_*` siguen prohibidos).
7. Cambios fuera de 018.2 pedidos en 018 §18 (`{ref}` en destinos de `add_step`/`retarget_step`/`set_initial_availability`, `describe_document` con geometría/bounds): **no** se hicieron (no estaban en este encargo). Para usar una Historia sobre elementos nuevos, el agente usa los ids de `refs` en una segunda llamada (`baseRevision = resultRevision`).
8. Orden de claves de `doc` en la respuesta MCP: sigue el del schema de entrada (zod reordena claves conocidas) — preexistente, no afecta a `deepStrictEqual` ni a la revisión (JSON canónico).
9. Sin `ARCHITECTURE.md`/`DECISIONS.md` nuevos conceptos más allá de las entradas añadidas (decisiones 85–86).

## 10. QA (resultados)

- Fluyo: `node --test test/*.test.cjs` **785/785**; `node --check js/*.js` OK; `git diff --check` OK.
- fluyo-mcp: `npm test` y `REQUIRE_FLUYO=1 npm test` **438/438**; `npm run build`, `check:kernel`, `check:config` OK.
- Mutaciones: Fluyo `test/fluyo-018-2-mutations.cjs` **26/26**; MCP `scripts/mutate-018-2.ts` **24/24** (refs ignoradas/duplicadas/de otra página/sin resolver, sin `createConnectionIn`/`createNodeIn`, conexiones o geometría desde TS, self-loop, ids duplicados, sin rollback, sin `baseRevision`, original modificado, sin `resultRevision`, documento en dryRun, schema laxo). Las dos primeras que sobrevivían (schema laxo, cubierto también por el kernel) se mataron con un test directo del schema.
- stdio real (`node dist/index.js`): describe → author (2 nodos) → author (conexión con id existente + ref nueva) → describe (valid, revisión = `resultRevision`) → Historia → `run_story` `completed`; lote inválido → `SELF_LOOP` sin documento; `baseRevision` mala → `REVISION_MISMATCH`; sin trazas.
- Compatibilidad: los 8 ejemplos + fixtures de Historias (multipágina, EventTypes) — crear un nodo solo añade ese nodo (el resto idéntico al normalizado) y la entrada no se toca; v1 (`state`) sigue ilegible.
- Chrome no ejecutado (no hay cambios de UI).

## 11. Para FLUYO-018.3

`update_*` (mover, redimensionar, etiquetas, waypoints; política 2 y 3 de §21), `delete_*` (B2, políticas 1 y 4), `{ref}` en destinos de Historia, `describe_document` con geometría/`bounds`, decisión sobre topes de coordenadas/nodos, y `atob`/`TextDecoder` en el `vm` si se quiere `image`. Release: bump de `sw.js` (model.js/state.js/story-authoring.js no cambian assets del cliente más allá de 018.1).
