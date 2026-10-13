# FLUYO-018.22 — Dependencias de llegada en el MCP

Estado: READY FOR COMMIT (sin commit, push ni deploy)
Owner/agente actual: —

> Repo público: solo contenido técnico apto para publicación.

## Objetivo

Que el MCP pueda CREAR y MODIFICAR dependencias de llegada (018.21) de forma explícita y segura, sin rediseñar la semántica:
`scenario.arrivalDependencies = [{ stepId, waitsForArrivalOf: [sendStepIds] }]` — «este momento no empieza hasta que llegue el token de ese SEND». El momento sigue siendo atómico, lo independiente no se retrasa y nada se infiere de las conexiones.

## Contexto

`AGENTS.md`, `.ai/tasks/FLUYO-018.21.md` (§ «Qué necesitará 018.22»), `.ai/DECISIONS.md` 168–173. Decisiones nuevas: **174–179**.

---

## 1. Auditoría previa (mapa antes de implementar)

| # | Pregunta | Respuesta (estado en HEAD `4647e60`) |
|---|---|---|
| 1 | `add_step` | Lo implementa el kernel: `FluyoAuthoring` (`js/story-authoring.js`), que compone `createStep` / `stepDefinitionForEvent` / `storyboardMoveStep` de `model.js`. `fluyo-mcp/src/authoring.ts` solo publica el schema zod, controla la revisión y da forma a la respuesta. |
| 2 | `remove_step` | `storyboardRemoveStep` (colapsa la espera). **No tocaba** `arrivalDependencies`: podía dejar referencias colgando (inofensivas al reproducir, pero huérfanas). |
| 3 | `duplicate_step` | `duplicateStep` (mismo momento, justo debajo). **No copiaba** la espera (el editor sí, con `copyArrivalWaits`): divergencia editor ↔ MCP. |
| 4 | `author_document` conserva campos de Historia | Sí: `projectFromProjectData` no toca campos de Historia desconocidos; `projectToSerializable` devuelve el `doc` tal cual. |
| 5 | Validación / normalización | `normalizeScenarios` (model.js) e `FluyoIntegrity` no conocen el campo (ni lo validan ni lo quitan). La regla de validez estaba SOLO en `story-clock.js` (fuera del kernel). |
| 6 | `describe_document` | `READ_MODEL` en `src/stories.ts` (proyección del kernel). No exponía nada del campo. |
| 7 | Serialización | Documento JSON v5 tal cual (`DocumentInputSchema` no elimina claves); `#d=` (link.ts) codifica el documento entero. El campo viaja. |
| 8 | Qué podía dejar huérfanas / eliminar | `remove_step` (huérfanas). `delete_story` / `delete_page` se llevan la Historia entera (sin problema). `delete_node`/`delete_connection` no pueden quitar pasos usados (B2). `update_event_type` no puede cambiar la primitiva de un evento usado (un SEND no deja de serlo por MCP). `move_step` / `set_wait` pueden dejar una dependencia SIN EFECTO (no huérfana). |
| 9 | Kernel copiado | `scripts/sync-kernel.ts`: `config.js, safe-svg.js, model.js, scenario-engine.js, scenario-playback.js, story-playback.js, document-integrity.js, story-authoring.js`. `story-clock.js` no. |
| 10 | Paridad editor ↔ MCP | (a) `check:kernel` (copia verbatim + `KERNEL_ID`); (b) goldens compartidos (`fluyo-017-2-golden.json`); (c) en Fluyo, `test/fluyo-017-2.test.cjs` / `017-3` construyen la misma Historia con el editor real en vm (`fluyo-016-harness.cjs`) y con `FluyoAuthoring`. **Hallazgo**: desde 018.21 esos tests de paridad fallaban (16) porque el harness no cargaba `story-clock.js`; se corrige aquí (una línea). |

## 2. Kernel: ¿entra `story-clock.js`? — **No**

El MCP solo manipula documentos: necesita la **regla de validez** (¿es un SEND anterior de la misma Historia?) y la **forma canónica** (reemplazar, limpiar, podar, copiar). No necesita el reloj (instantes visibles, pausa, salto, copia del Trace): eso lo hace el editor al reproducir.

Por eso la parte pura y estructural se **mueve** de `story-clock.js` a `model.js` (que ya es kernel) y `story-clock.js` la **reexporta** con los mismos nombres (`FluyoStoryClock.arrivalDependencies === arrivalDependencies`). Resultado:

- una sola implementación, la misma para editor y MCP (paridad por construcción);
- el kernel crece ≈ 90 líneas de regla (no ≈ 200 de reloj);
- un cambio de presentación del reloj no obliga a resincronizar el MCP;
- `KERNEL_FILES` no cambia; cambia el contenido de `model.js` y `story-authoring.js` → nuevo `KERNEL_ID` (`npm run sync:kernel`, `check:kernel` ✔).

Único cambio de comportamiento en el editor: `copyArrivalWaits` (duplicar un paso) copia solo las dependencias **válidas** del original (antes copiaba también lo almacenado sin efecto). Mismo resultado visible; ahora coincide con lo que pide el MCP (dec. 177).

## 3. Contrato MCP (API final)

### `add_step` + `waitsForArrivalOf?: (stepId | {ref})[]`

- Ids de pasos SEND de la misma Historia en un momento anterior; `{ref}` de un paso creado antes en el lote.
- Se registra en `scenario.arrivalDependencies` (nunca en el Step). Ausente o `[]` → no se crea nada (ni una entrada vacía).
- Respuesta: `changes[].waitsForArrivalOf` (solo si hay).

### `set_arrival_dependencies` (alcance `story`)

```json
{ "op": "set_arrival_dependencies", "scope": "story", "pageIndex": 0, "storyId": 1, "stepId": 4, "waitsForArrivalOf": [3] }
```

- **Reemplaza** la lista del paso; `[]` la borra; si no queda ninguna, el campo desaparece (como una Historia antigua).
- Respuesta: `{entityKind:"step", entityId, storyId, from, to, changed, affects}` (`from` = lo almacenado antes para ese paso).
- Fijar lo mismo es `changed:false` y no cambia la revisión.

### Validación (rechazo explícito, opción A)

`INVALID_ARRIVAL_DEPENDENCY {field, pageIndex, storyId, stepId, sendId, reason, candidates}`:

| reason | caso |
|---|---|
| `send_missing` | el SEND no existe en la Historia |
| `not_send` | el objetivo no es un SEND |
| `not_earlier` | el SEND es del mismo momento o posterior (el momento es atómico) |
| `self` | el paso se espera a sí mismo |
| `cycle` | el SEND ya espera (directa o indirectamente) a este paso — siempre es también «no anterior» |
| `other_story` | `{ref}` de un paso de otra Historia |

Paso dependiente inexistente → `STEP_NOT_FOUND`; `{ref}` desconocida → `UNKNOWN_REF`; sin lista / no lista / campo extra → `INVALID_OPERATION`. La autoridad es `arrivalCandidates` (model.js); la razón solo explica. **Documentos antiguos**: lo que ya traen no se revalida (lectura tolerante de 018.21): se leen, se reproducen y se editan igual.

### `remove_step` / `duplicate_step` / `duplicate_story` / reordenar

- `remove_step` del SEND objetivo o del dependiente: `pruneArrivalDependencies` (como el editor). Sin huérfanas. `changes[].cascade.arrivalDependencies = [{stepId, sendId}]` (solo si quitó algo).
- `duplicate_step` del dependiente: la copia (mismo momento) espera lo que el original espera **de verdad** (solo lo válido). `duplicate_step` del SEND objetivo: **las dependencias existentes siguen apuntando al SEND original**; nunca se redirigen a la copia (la copia es un envío nuevo e independiente; redirigir cambiaría en silencio qué espera otro momento).
- `duplicate_story`: copia literal. Los ids de Step son por Historia y la copia los conserva, así que las dependencias de la copia ya apuntan a sus propios pasos (no hay remapeo que hacer). Editar la copia no toca el original.
- `move_step` / `set_wait`: el **dato almacenado** se conserva; la **dependencia válida para reproducir** puede dejar de serlo (envío en el mismo momento o después). Se ignora al reproducir (sin tiempos infinitos: una pasada) y la respuesta avisa: `warnings: [{code:"ARRIVAL_DEPENDENCY_INACTIVE", pageIndex, storyId, stepId, sendId, reason, message}]` (solo lo que el lote dejó sin efecto). Si el orden se restablece, vuelve a aplicar.

### `describe_document`

Por Historia: `arrivalDependencies` (lo almacenado, canónico) e `inactiveArrivalDependencies` (`[{stepId, sendId, reason}]`). Por paso: `waitsForArrivalOf` (solo lo válido). Por momento: `waitsFor` (unión de sus pasos: atómico). Sin dependencias, **ninguna clave nueva** (las respuestas de Historias antiguas son idénticas). `unmodeled` explica que es presentación (no cambia el Trace, no es latencia, no se infiere).

### `run_story`

Sin cambios: el Trace del motor es idéntico con y sin dependencias. No se exponen instantes visibles (son del reloj, fuera del kernel).

## 4. Archivos

**fluyo**
- `js/model.js` — regla y forma canónica de las dependencias de llegada (movidas de `story-clock.js`) + `withArrivalWaits` (reemplazar); `copyArrivalWaits` copia solo lo válido.
- `js/story-clock.js` — reexporta la regla (sin reimplementarla); el reloj no cambia.
- `js/story-authoring.js` — `set_arrival_dependencies`, `add_step.waitsForArrivalOf`, validación con razón, `remove_step` (prune + cascade), `duplicate_step` (copia válidas), avisos `ARRIVAL_DEPENDENCY_INACTIVE`.
- `sw.js` — `CACHE` v80.
- `test/fluyo-018-22.test.cjs` (nuevo), `test/fluyo-016-harness.cjs` (carga `story-clock.js`), aserciones `v79 → v80` en los tests de release anteriores (solo la constante).
- `.ai/tasks/FLUYO-018.22.md`, `.ai/DECISIONS.md` (174–179), `.ai/ARCHITECTURE.md`.

**fluyo-mcp**
- `src/authoring.ts` — schema (`waitsForArrivalOf`, `set_arrival_dependencies`), `warnings` en la respuesta y en el resumen.
- `src/stories.ts` — `describe_document` (almacenado / inactivo / por paso / por momento); `UNMODELED`.
- `src/server.ts` — descripción de `author_document` y `describe_document`.
- `src/generated/kernel-sources.ts` — regenerado (`npm run sync:kernel`).
- `README.md`; `test/fluyo-018-22.test.ts` y `scripts/mutate-018-22.ts` (nuevos).

## 5. Pruebas

| Suite | Resultado | Tiempo |
|---|---|---|
| `fluyo-mcp`: `node --test dist-test/test/fluyo-018-22.test.js` (tras `npm run build:test`) | **33/33** | 1,3 s |
| `fluyo-mcp` contrato: `contract`, `tools`, `fluyo-017-1`, `017-1-qa`, `017-2`, `017-3`, `018-4-1`, `no-esm` | **247/247** | 6,7 s |
| `fluyo-mcp`: `npm run check:kernel` | ✔ idéntico | — |
| `fluyo`: `node --test test/fluyo-018-22.test.cjs` | **4/4** | 0,2 s |
| `fluyo`: `fluyo-018-21.test.cjs` | 19/20 | 1,4 s |
| `fluyo`: `fluyo-017-2.test.cjs` / `fluyo-017-3.test.cjs` (paridad editor ↔ `FluyoAuthoring`) | **66/66** · **59/59** (en HEAD: 63/66 · 46/59, ver auditoría 10) | — |
| `fluyo`: `fluyo-018-18.test.cjs` / `fluyo-018-19.test.cjs` | 12/13 · 12/13 | — |

Los fallos restantes son los **tests de alcance contra HEAD** de 018.18, 018.19 y 018.21 («`model.js` / kernel idénticos a HEAD»): este slice cambia `model.js`, `story-authoring.js` y `story-clock.js` a propósito; vuelven a pasar con el commit. No se ejecutaron las baterías históricas completas.

Cobertura de la suite MCP (casos pedidos 1–20): add_step sin/con dependencia; set (crear, reemplazar, limpiar, idempotente); SEND inexistente; dependiente inexistente; no SEND; futuro y mismo momento; self; ciclo; otra Historia; forma y schema; documento antiguo con dependencia inválida; remove del objetivo y del dependiente; duplicate del dependiente (solo válidas) y del objetivo (sin redirigir); duplicate_story; move_step + aviso + restablecer; Trace igual; author conserva en 8 operaciones; describe (almacenado/aplica/atómico/includeSteps:false/unmodeled) también por el MCP real; Historia antigua sin claves nuevas; reproducción con `story-clock.js` real; paridad con las funciones del editor (declarar, quitar, duplicar, eliminar) y de la regla (lo ignorado coincide); Share `#d=`; kernel sin `story-clock.js`; MCP sin reglas propias; MCP real (zod, rechazo legible, schema publicado).

## 6. Mutaciones — `node scripts/mutate-018-22.ts` (fluyo-mcp)

**23/23 detectadas** (copias temporales; las de kernel se regeneran con el `sync-kernel` real y el test de paridad lee la misma copia de `fluyo/js`):

ignorar `waitsForArrivalOf` · guardar la dependencia en el Step · aceptar SEND inexistente · aceptar no SEND · aceptar objetivo futuro · `remove_step` deja huérfanas · `duplicate_story` desplaza ids · `duplicate_step` redirige al duplicado · `set_arrival_dependencies` añade en vez de reemplazar · limpiar no elimina · aceptar self · no explicar el ciclo · aceptar `{ref}` de otra Historia · `[]` crea entrada vacía · regla admite el mismo momento (model.js) · duplicar copia lo inválido (model.js) · prune no quita envíos eliminados (model.js) · sin avisos al reordenar · describe sin `waitsForArrivalOf` · describe sin `waitsFor` · describe mezcla inactivo y almacenado · `author_document` pierde `warnings` · schema sin `set_arrival_dependencies`.

## 7. QA integrada (Chrome dirigido, ≈ 2,5 min)

Documentos creados **enteros por el MCP** (`author_document` sobre un documento vacío: nodos, conexiones, eventos, Historia y pasos con `waitsForArrivalOf` por `{ref}`) y abiertos en Fluyo por su `editorUrl` (`#d=`), servidos en local con `CACHE` v80. Medido con el bucle real del editor (`scTick` + botón «Reproducir»; el panel estaba oculto, así que se condujo el bucle con el reloj real):

| Historia | Momentos visibles | Esperado |
|---|---|---|
| A→B→C (M2 espera M1, M4 espera M3) | 0 (primer tick) → 1100 → 1600 → 2700 | 0 → 1100 → 1600 → 2700 ✔ |
| A SEND B · X cae (500) · B recibe esperando a A | 0 → 500 → 1100 | 0 → 500 → 1100 ✔ |

La línea de tiempo muestra «No empieza hasta que llegue «Petición» (A → B)» / «(B → C)». «Compartir historia» → Viewer (`/s/#d=`): la dependencia llega y el horario es 0 → 500 → 1100.

## 8. Compatibilidad

- Historias sin `arrivalDependencies` y documentos anteriores a 018.21: mismas respuestas de `describe_document` (sin claves nuevas), mismo `author_document`, mismo Trace.
- Documentos con dependencias inválidas: se leen y editan; solo lo escrito se valida.
- Editor, Present, Viewer y Share: misma regla (reexportada); reproducción verificada en Chrome. Formato del Step sin cambios (`version` 5, `engineVersion` 2).
- Clientes con caché v79: tienen la regla dentro de `story-clock.js` (idéntica salvo `copyArrivalWaits`); v80 la toma de `model.js`.

## 9. Riesgos

1. **Orden de carga**: `story-clock.js` necesita las funciones de `model.js`; el editor y el Viewer ya cargan `model.js` antes (test de release). Un tercer cargador de `story-clock.js` sin `model.js` fallaría al reproducir con dependencias.
2. **Globales nuevas en `model.js`** (`arrivalDependencies`, `arrivalCandidates`, …): ámbito global compartido; no colisionan hoy (búsqueda en `js/`).
3. **Avisos, no rechazos**: un lote puede dejar una dependencia sin efecto (`move_step`). Es coherente con 018.21 (dato conservado), pero un agente que ignore `warnings` puede no notarlo.
4. **`KERNEL_ID` nuevo**: el despliegue del MCP debe ir con el `kernel-sources.ts` regenerado (commit en `fluyo-mcp`).
5. **Tests de alcance contra HEAD** (018.18/019/021) fallan hasta el commit, por diseño de esos tests.

## Handoff

- **Hecho**: contrato MCP completo (API, validación, integridad, lectura), regla compartida en el kernel, `story-clock.js` fuera del kernel, harness de paridad reparado, suites y mutaciones, QA en Chrome.
- **Commit** (dos repos): `fluyo` (js, sw.js, tests, `.ai`) y `fluyo-mcp` (src, `kernel-sources.ts`, README, test, script). Sin deploy.
- **Siguiente paso**: revisión y commit; después desplegar el MCP con el kernel nuevo y publicar `CACHE` v80. Opcional más adelante: exponer instantes visibles en `run_story` (requeriría el reloj en el kernel; hoy no compensa).

# FLUYO-018.22 — READY FOR COMMIT
