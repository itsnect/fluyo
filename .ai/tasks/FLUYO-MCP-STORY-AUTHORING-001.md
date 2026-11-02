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

Evidencia reproducible en `C:\Proyectos\fluyo-new\FLUYO-MCP-STORY-AUTHORING-001-evidencia\` (fuera del repo).

**Escenarios A–E y enlace humano, en Chrome real contra fluyo.space v123, con el MCP de la rama: 24/0.**

| Escenario | Resultado |
|---|---|
| A · éxito | MCP `no_failures`; UI «Sin fallos» |
| B · fallo | MCP `failed`, momento 3, `target_down`, Bank; UI «Falla en el paso 3» |
| C · referencia inválida | Estructurado, corto y con candidatos |
| D · Historias existentes | Intactas byte a byte y por Trace; `STORY_OUTCOME_CHANGED` cuando cambian |
| E · round-trip | MCP → UI («Falla aquí» real) → serializar → MCP: UI y MCP coinciden; la otra Historia conserva su Trace |
| Enlace humano | Lectura sin revisión; sin revisión no se escribe; revisión incorrecta y enlace truncado, rechazados |
| «Falla aquí» | **Trace MCP == el de la acción real de la UI** |

**Paridad del desenlace:** MCP == Editor (también al terminar de reproducir) == Viewer (portada, final y «Otras formas») == Present (portada y reproducido hasta el final).

**Agent QA, verificada con el registro del servidor y volviendo a ejecutar cada documento final.** Sin pistas internas.

| Cliente | Modelo | Intención | Llamadas | Rechazos | Resultado | Idioma |
|---|---|---|---|---|---|---|
| **Nativo** (Claude Code, stdio) | Sonnet | Compra con éxito, enlace | 2 | 0 | 5 pasos, `no_failures` | Inglés ✅ |
| **Nativo** | Haiku | Banco caído, **solo enlace** (1.ª regla) | 2 | 0 | `failed`, momento 3 | **Español ❌** |
| **Nativo** | Haiku | Lo mismo (regla final) | 2 | 0 | `failed`, momento 3 | Inglés ✅ |
| CLI | Sonnet | Banco caído, con Historia previa | 6 | 0 | `failed`, momento 3; previa idéntica | Inglés ✅ |
| CLI | Sonnet | Lo mismo, en español (1.ª regla) | 4 | 0 | `failed`, momento 3; previa idéntica | Español ✅ |
| CLI | Haiku | Lo mismo, en español (regla final) | 2 | 0 | `failed`, momento 3; previa idéntica | Español ✅ |

**Sin cubrir con cliente nativo:** español y fallo sobre una Historia existente. El clasificador de permisos del entorno bloqueó esas dos sesiones, y se dejaron sin reintentar. Solo hay evidencia por CLI.

**Regresión:**

- MCP: `npm test` 969/969 (antes 918/919; el fallo era el test desfasado de `reverse`).
- Mutaciones: S1 40/40; TE-002 18/18, TE-003 16/16, TE-004 14/14, MSG 27/27, REV 32/32, CC 11/11, DESC 12/12.
- Respuestas: 149 sobre 22 documentos, idénticas a `464f4e0` sin los campos nuevos.
- `fluyo`: en los 33 archivos de test que leen el MCP hermano, los mismos 17 fallos con el MCP anterior y con esta rama; **delta 0**. Se adaptaron 6 tests (`fluyo-018-18`, `fluyo-018-22`, `fluyo-018-29`, `fluyo-i18n-002-s2b`, `fluyo-stories-2-0-s2a` y `-s2b`), que fijaban `story-clock.js` fuera del kernel, la lista del kernel o el SHA exacto del hermano. Ninguno se sirve.

## Limitations

- **La URL del editor no cambia al editar** y abre en Editar sin elegir la Historia. Diferido por el PO: es web y consumiría v124.
- **Comentario desfasado** en `js/story-clock.js` («NO es kernel»), y lo mismo en `.ai/ARCHITECTURE.md`. Deuda: corregir el del archivo servido en la próxima slice web.
- **Sin parentesco de variantes**, por decisión. El experimento ciego de variantes queda para después de S1.

## Rollout

Solo `fluyo-mcp`: worktree limpio, `deploy mcp.bat`, `verify-deploy` y smoke en producción, **con aprobación explícita**. `fluyo.space` no cambia.
