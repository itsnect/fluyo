# FLUYO-MCP-STORY-AUTHORING-001 · Agente → Historia → Revisión humana

**Estado: S1 «Reliable Story Authoring Contract» implementada en local, sin push ni deploy.** Fase 0: [FLUYO-MCP-STORY-AUTHORING-001-AUDIT.md](FLUYO-MCP-STORY-AUTHORING-001-AUDIT.md), aprobada por el PO. Decisiones 326–330.

Base: `fluyo` `origin/main` `9eeeb42` (v123) · `fluyo-mcp` `origin/main` `464f4e0`. Rama en los dos repos: `mcp-story-authoring-001`. **`fluyo` solo cambia documentación:** v124 sigue libre.

## Problem

Fluyo quiere que humanos y agentes trabajen sobre la misma representación explícita. La primitive es que un agente escriba una explicación que un humano pueda inspeccionar, no que entienda tu código.

## Hypothesis

Un agente con un documento existente produce una Historia válida, con frases, fallo real y desenlace correcto, sin inventar semántica. El humano la abre, reproduce, modifica y comparte.

**Fase 0 demostró que ya funcionaba.** Por eso S1 no construye una API nueva: hace fiable el contrato que existe.

## Architecture

- **FLUYO es la fuente de verdad.** El agente propone con operaciones estructuradas; el kernel valida; el motor decide.
- **Sin estado.** El MCP no guarda nada: recibe un documento y devuelve otro, con `baseRevision` como control de concurrencia.
- **Un solo motor y una sola regla de desenlace.** `story-clock.js` entra verbatim en el kernel del MCP. Ninguna regla se porta a TypeScript.
- **BYO agent.** Fluyo no paga inferencia ni asume un cliente.

## MCP contract

| Tool | Antes | Después | ¿Rompe? |
|---|---|---|---|
| `describe_document` | Un enlace exigía `baseRevision`: el enlace de una persona era ilegible | Lo lee sin ella y da la `revision` canónica (`linkRevisionUnverified:true`); `/s/` lleva `linkKind:"viewer"` | No: antes era error |
| `describe_document` | Sin desenlace; solo respuesta completa | `stories[].outcome`; `detail:"summary"` opcional | No: aditivo |
| `run_story` | Estados por paso; el desenlace había que deducirlo | `storyOutcome`; `detail:"summary"` omite `trace` y `unmodeled` | No: aditivo |
| `author_document` | Sin desenlace; efectos sobre otras Historias invisibles | `stories[]` con `outcome`, también en `dryRun`; aviso `STORY_OUTCOME_CHANGED`; `storyRefs`; `candidates`; `detail:"summary"` | No: aditivo |
| Todas | Rechazo de Zod como texto, hasta 3,8 KB | Mismo `isError` y prefijo, con 2.º bloque `SCHEMA_INVALID` | No: el 1.er bloque conserva el prefijo |
| `LINK_REVISION_*` | Mensaje que culpaba a la copia | Explica también el caso del enlace de una persona | No: mismo código |

**15 tools y 29 operaciones, igual que antes.** Con los campos nuevos quitados, 149 respuestas sobre 22 documentos son idénticas a `464f4e0` byte a byte, salvo `kernelId`.

**`refs` no cambia:** lo creado con `ref` en Historias, pasos y eventos va en la clave nueva `storyRefs`, para no alterar lo que un cliente ya lee.

## Story contract

Sin cambios: formato v5, motor v2, sin `variantOf`. El desenlace:

```json
{ "status": "no_failures" }
{ "status": "failed", "moment": 3, "stepId": 3, "reason": "target_down", "reasonNode": { "id": 3, "label": "Bank" } }
{ "status": "empty" }
{ "status": "not_executable" }
```

`moment` empieza en 1, como el N de «Falla en el paso N». El texto visible sigue siendo de la UI y de su idioma.

## Validation y errors

Antes y después, para `target:{nodeId:"Bank"}`:

| | Bytes | Contenido |
|---|---|---|
| Antes | 3 772 | Árbol de ramas de unión de Zod |
| Después | 498 | `{code:"SCHEMA_INVALID", path:"operations[0].target.nodeId", operationIndex:0, operation:"add_step", issue:"invalid_type", expected:"number \| object", received:"string"}` |

**`TARGET_NOT_FOUND`, revisado.** La clasificación no cambia: una forma que no encaja con el evento es `TARGET_INCOMPATIBLE` y se comprueba antes que la existencia, porque es lo primero que hay que arreglar. Los dos códigos traen ahora `candidates` de esa página (hasta 30).

## Side effects

```json
{ "ok": true, "touchedStories": [], "warnings": [{
  "code": "STORY_OUTCOME_CHANGED", "pageIndex": 0, "storyId": 1, "name": "Successful purchase", "directlyEdited": false,
  "before": { "status": "no_failures" },
  "after": { "status": "failed", "moment": 2, "stepId": 2, "reason": "target_down", "reasonNode": { "id": 3, "label": "Bank" } },
  "message": "El lote no editó la Historia 1, pero su desenlace cambió." }] }
```

## Token efficiency

Medido en las dos versiones, sin proyecciones. Flujo: inspeccionar, crear una Historia de 4 pasos y conocer el desenlace. Tokens con las densidades de TE-003 (estimación); bytes, reales.

| Documento | Llamadas | Recibidos | Tokens recibidos | Acumulados |
|---|---|---|---|---|
| 3 nodos | 3 → 2 | 9 912 → 3 420 B | 5 356 → 2 188 (−59 %) | 10 295 → 2 815 (−73 %) |
| Compra online | 3 → 2 | 15 362 → 4 485 B | 8 268 → 2 962 (−64 %) | 18 495 → 3 857 (−79 %) |
| Microservicios | 3 → 2 | 12 970 → 4 540 B | 7 097 → 2 984 (−58 %) | 14 545 → 3 890 (−73 %) |
| RAG, 38 pasos | 3 → 2 | 29 237 → 6 688 B | 15 569 → 4 570 (−71 %) | 38 870 → 5 968 (−85 %) |

Catálogo: 54 691 → **56 605 B** (guardia 63 000; guardia propia de S1, 57 000).

## Security

Sin superficie nueva: la lectura sin revisión solo lee, por el mismo decodificador, y lo truncado o corrupto se rechaza. Un `SCHEMA_INVALID` no repite valores de la entrada. Sin analytics de contenido: `http-logging.ts` no cambia.

**Límite conocido:** sin revisión no se puede saber si una copia inexacta decodifica a otro documento válido. Por eso va marcado (`linkRevisionUnverified`), y escribir con esa revisión sobre el enlace bueno se rechaza.

## Implementation

Solo `fluyo-mcp`:

| Archivo | Cambio |
|---|---|
| `scripts/sync-kernel.ts`, `src/generated/kernel-sources.ts` | `story-clock.js` en el kernel, verbatim. `kernelId` nuevo |
| `src/stories.ts` | Forma del desenlace, `summary` de `describe` y `run_story` |
| `src/authoring.ts` | `stories`, aviso, `storyRefs`, `candidates`, `summary`, descriptions de campos |
| `src/link-input.ts`, `src/server.ts` | Lectura sin revisión; descriptions; handler de errores |
| `src/schema-errors.ts` | Nuevo |
| `test/`, `scripts/mutate-mcp-story-authoring-001.ts`, `README.md` | Tests, mutaciones y documentación |

## Language neutrality

La primera regla, en español, **falló en la QA**: Haiku recibió una petición en inglés y escribió en español. Se reescribió en inglés, al principio de la description y en los campos donde se escribe el texto (`name`, `message`, `sentence`). El catálogo sigue siendo uno solo y los nombres técnicos no cambian.

## QA

Resultados y regresión: ver el cierre de la tarea en el informe al PO y `FLUYO-MCP-STORY-AUTHORING-001-evidencia\` (fuera del repo).

## Limitations

- **La URL del editor no cambia al editar** y abre en Editar sin elegir la Historia. Diferido por el PO: es web y consumiría v124.
- **Comentario desfasado** en `js/story-clock.js` («NO es kernel»), y lo mismo en `.ai/ARCHITECTURE.md`. Deuda: corregir el del archivo servido en la próxima slice web.
- **Sin parentesco de variantes**, por decisión. El experimento ciego de variantes queda para después de S1.

## Rollout

Solo `fluyo-mcp`: worktree limpio, `deploy mcp.bat`, `verify-deploy` y smoke en producción, **con aprobación explícita**. `fluyo.space` no cambia.
