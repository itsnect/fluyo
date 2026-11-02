# FLUYO-MCP-STORY-AUTHORING-VARIANTS-EXPERIMENT

Fecha: 2026-11-02 · Contrato probado: el desplegado, `fluyo-mcp` `4a172f1` en Cloud Run `fluyo-mcp-00036-jhh` · UI: fluyo.space v123 · Sin cambios de producto.

**Recomendación: `DESCRIPTION CHANGE RECOMMENDED`.** Experimento, no implementación: nada se aplica sin decisión del PO.

## Resultado

**8 de 16 ejecuciones pasan.** Ninguna dejó un documento inválido ni rompió la UI, y ninguna necesitó parentesco. Solo una alteró una Historia existente.

| Caso | PASS | Lectura |
|---|---|---|
| V1 · variante con fallo | 3/4 | Funciona; un fallo de Haiku |
| V2 · variante sin fallo | 4/4 | Funciona, con el prefijo idéntico al de la UI |
| V3 · varias Historias, paso 4 | 1/4 | Base correcta 4/4; divergencia correcta solo 1/4 |
| V4 · petición ambigua | 0/4 | **Ninguno preguntó** |

**El contrato puede expresar la variante:** nueve ejecuciones produjeron un prefijo idéntico byte a byte al de «Otra forma desde aquí», incluida la del caso más difícil. Lo que falla es entender tres cosas que el catálogo no dice:

1. Que «desde el paso N» **conserva** el paso N.
2. Que el paso N es el N-ésimo **momento**, no el `stepId`.
3. Que con varias Historias candidatas **hay que preguntar**.

## Hypothesis

Stories 2.0 representa una variante como otra Historia de la misma página, con un prefijo común hasta el punto de divergencia y sin campo de parentesco (decisiones 314 y 317). La hipótesis: un agente puede inferir ese modelo del documento y del catálogo MCP actual, sin una primitive de variantes.

**Resultado: parcialmente confirmada.** Infieren el modelo (Historia nueva, misma página, prefijo común), pero no de forma fiable el punto de divergencia ni cuándo preguntar.

## Setup

- **Agentes:** 16 sesiones de Claude Code nuevas, cada una en su carpeta, sin memoria del proyecto. 8 Sonnet y 8 Haiku, 2 por caso y modelo.
- **MCP:** conector nativo por stdio hacia `https://mcp.fluyo.space/mcp`, a través de un proxy que solo registra.
- **Documentos:** el sistema Customer, Store, Payment, Bank, Backup processor y Warehouse, con tres conjuntos de Historias.
- **Referencia canónica:** la acción real `scBranchFrom` («Otra forma desde aquí») en fluyo.space, ejecutada por caso.
- **Evaluación:** la base y la divergencia se deducen del documento final, comparando con cada Historia original. No se usa lo que informa el agente.

### Prompts

Instrucción, igual en las 16:

> You have an MCP server called `fluyo` connected to this session (its tools appear as `mcp__fluyo__*`; load them if they are deferred). You know nothing about this product beyond what those tools say.
>
> The user's message is the text of the file `request.txt`. Read that one file, then do what the user asks, using only the `fluyo` tools. Do not read any other file, list folders, write files, run shell commands or search the web. If the `fluyo` tools are not available, say so and stop: do not work around it.
>
> When finished, end with: 1. MESSAGE TO USER: exactly what you would tell the user. 2. CONTRACT NOTES: anything in the tools' contract that confused you, errors you hit, and calls you felt were wasted (brief).

`request.txt` contiene solo el enlace y la intención:

| Caso | Documento | Intención |
|---|---|---|
| V1 | Una Historia | Create another way from step 2 where the bank stops responding. |
| V2 | Una Historia | Create another way from step 2 where payment uses a different route. |
| V3 | Tres Historias; «Card declined» tiene dos pasos en el momento 2 | In the "Card declined" story, create another way from step 4 where Payment retries through the backup processor. |
| V4 | Dos Historias; su paso 2 es distinto | Create another way from step 2 where the request fails. |

V3 es deliberadamente más difícil: con dos pasos simultáneos, el paso 4 que ve una persona (momento 4) es el `stepId` 5. En V1 y V2 los dos números coinciden, así que esos casos no pueden distinguirlos.

## Criterio de evaluación

Un PASS exige todo esto: Historia nueva, misma página, prefijo igual a la base hasta el momento N incluido, divergencia justo después, desenlace esperado, originales intactas byte a byte, sistema sin cambios, documento válido, ejecución por `run_story`, sin campos inventados, y UI correcta.

**«From step N»**, por regla del PO: conserva el paso N y diverge después. Conservar menos es FAIL de paridad aunque la Historia sea técnicamente válida.

**V4:** dos Historias son candidatas razonables, porque ambas tienen un paso 2 que puede fallar. La intención no permite elegir. Elegir sin preguntar es **UNSAFE ASSUMPTION**, aunque se explique; por eso ninguna ejecución de V4 cuenta como PASS.

## Runs

### Matriz agregada

| Caso | Modelo | Runs | Structural PASS | Wrong base | Wrong divergence | Unsafe assumption | Asked clarification | Invalid document |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| V1 | Sonnet | 2 | 2/2 | 0 | 0 | 0 | 0 | 0 |
| V1 | Haiku | 2 | 1/2 | 0 | 1 | 0 | 0 | 0 |
| V2 | Sonnet | 2 | 2/2 | 0 | 0 | 0 | 0 | 0 |
| V2 | Haiku | 2 | 2/2 | 0 | 0 | 0 | 0 | 0 |
| V3 | Sonnet | 2 | 0/2 | 0 | 2 | 0 | 0 | 0 |
| V3 | Haiku | 2 | 1/2 | 0 | 1 | 0 | 0 | 0 |
| V4 | Sonnet | 2 | 0/2 | 0 | 1 | 2 | 0 | 0 |
| V4 | Haiku | 2 | 0/2 | 0 | 2 | 2 | 0 | 0 |
| **Total** | | **16** | **8/16** | **0** | **7** | **4** | **0** | **0** |

### Por ejecución

`Reint. sem.` = el agente produjo una operación incorrecta. `Reint. transp.` = límite de peticiones; no cuenta como fallo del agente. `≡ UI` = prefijo idéntico byte a byte al canónico.

| Run | Caso | Modelo | Calls | Reint. sem. | Reint. transp. | Tools | Base | Nueva | Prefijo | Divergencia | Diverge tras | Outcome | Outcome OK | ≡ UI | Originales | Válido | UI | Resultado |
|---|---|---|---:|---:|---:|---|---|---|---|---|---:|---|---|---|---|---|---|---|
| run-09 | V1 | Haiku | 4 | 1 | 5 | describe(s), describe, author(s) | Successful purchase | ✅ | ✅ | ✅ | 2 | failed m4 Bank | ✅ | ✅ | ✅ | ✅ | ✅ | **PASS** |
| run-06 | V1 | Haiku | 3 | 0 | 3 | describe, author(s), run(s) | Successful purchase | ✅ | ❌ | ❌ | 1 | no_failures | ❌ | ❌ | ✅ | ✅ | ✅ | FAIL |
| run-05 | V1 | Sonnet | 2 | 0 | 2 | describe, author(s) | Successful purchase | ✅ | ✅ | ✅ | 2 | failed m4 Bank | ✅ | ✅ | ✅ | ✅ | ✅ | **PASS** |
| run-10 | V1 | Sonnet | 2 | 0 | 1 | describe, author(s) | Successful purchase | ✅ | ✅ | ✅ | 2 | failed m4 Bank | ✅ | ✅ | ✅ | ✅ | ✅ | **PASS** |
| run-13 | V2 | Haiku | 2 | 0 | 7 | describe, author(s), run(s) | Successful purchase | ✅ | ✅ | ✅ | 2 | no_failures | ✅ | ✅ | ✅ | ✅ | ✅ | **PASS** |
| run-01 | V2 | Haiku | 2 | 0 | 0 | describe, author | Successful purchase | ✅ | ✅ | ✅ | 2 | no_failures | ✅ | ✅ | ✅ | ✅ | ✅ | **PASS** |
| run-02 | V2 | Sonnet | 2 | 0 | 0 | describe, author(s) | Successful purchase | ✅ | ✅ | ✅ | 2 | no_failures | ✅ | ✅ | ✅ | ✅ | ✅ | **PASS** |
| run-14 | V2 | Sonnet | 2 | 0 | 0 | describe, author | Successful purchase | ✅ | ✅ | ✅ | 2 | no_failures | ✅ | ✅ | ✅ | ✅ | ✅ | **PASS** |
| run-15 | V3 | Haiku | 4 | 0 | 0 | describe, author, author, describe(s) | Card declined | ✅ | ✅ | ✅ | 4 | no_failures | ✅ | ✅ | ✅ | ✅ | ✅ | **PASS** |
| run-07 | V3 | Haiku | 2 | 0 | 3 | describe, author | Card declined | ❌ | — | — | — | — | — | — | ❌ | ✅ | ✅ | FAIL |
| run-08 | V3 | Sonnet | 2 | 0 | 2 | describe, author(s) | Card declined | ✅ | ❌ | ❌ | 2 | no_failures | ✅ | ❌ | ✅ | ✅ | ✅ | FAIL |
| run-12 | V3 | Sonnet | 2 | 0 | 1 | describe, author(s) | Card declined | ✅ | ❌ | ❌ | 2 | no_failures | ✅ | ❌ | ✅ | ✅ | ✅ | FAIL |
| run-11 | V4 | Haiku | 2 | 0 | 6 | describe, author(s) | Successful purchase | ✅ | ❌ | ❌ | 1 | failed m3 Payment | — | ❌ | ✅ | ✅ | ✅ | FAIL |
| run-04 | V4 | Haiku | 2 | 0 | 0 | describe, author(s) | Successful purchase | ✅ | ❌ | ❌ | 1 | failed m3 Payment | — | ❌ | ✅ | ✅ | ✅ | FAIL |
| run-03 | V4 | Sonnet | 2 | 0 | 0 | describe, author(s) | Successful purchase | ✅ | ❌ | ❌ | 1 | failed m3 Payment | — | ❌ | ✅ | ✅ | ✅ | FAIL |
| run-16 | V4 | Sonnet | 3 | 1 | 0 | describe, author | Successful purchase | ✅ | ✅ | ✅ | 2 | failed m4 Bank | — | ✅ | ✅ | ✅ | ✅ | FAIL (unsafe) |

**UI, las 16:** el editor da el mismo desenlace que el MCP, «Otras formas» lista las demás Historias, el Viewer llega hasta el final con ese desenlace y Present abre con él. 0 errores de JavaScript. Es una comprobación programática en la app real, no una revisión visual.

## Failure modes

| Modo | Ejecuciones | Qué pasó |
|---|---|---|
| **No preguntó ante una ambigüedad real** | run-03, 04, 11, 16 | Todas eligieron «Successful purchase» sin aclaración. run-03 y run-16 lo declararon, y run-16 razonó que «Store pickup has no Payment step», aunque la petición no nombraba Payment. run-04 y run-11 no dejaron claro que fuera una suposición |
| **El paso N se reemplaza en vez de conservarse** | run-03, 04, 11 | Pusieron la caída antes del paso 2: 1 → DOWN → 2. El prefijo de la UI es 1, 2. La intención «where the request fails» empuja a esa lectura |
| **`stepId` en vez de número de paso, y además reemplazo** | run-08, 12 | Tomaron el `stepId` 4 (momento 3) como «paso 4» y lo sustituyeron: conservaron solo los momentos 1 y 2. run-12 lo dijo y ofreció la otra lectura |
| **Editar en vez de crear** | run-07 | Añadió 4 pasos al final de «Card declined» y **alteró la Historia original**. Es el único caso |
| **Caída en el mismo momento y sin fallo** | run-06 | Unió la caída al paso 2 y rodeó el banco por el procesador de respaldo: `no_failures` en una Historia llamada «Bank stops responding» |

**Lo que no falló nunca:** base equivocada 0, documentos inválidos 0, sistema alterado 0, campos inventados 0, UI rota 0.

**Reintentos semánticos: 2**, y ambos se recuperaron solos:
- run-09: `INVALID_ARRIVAL_DEPENDENCY`.
- run-16: enlace mal copiado, rechazado con `DOCUMENT_LINK_UNREADABLE` (`base64`).

## Structural comparison

Frente a «Otra forma desde aquí»:

| Aspecto | Resultado |
|---|---|
| Prefijo idéntico en bytes, ids, tiempos y dependencias de llegada | 9 de 16: V1 ×3, V2 ×4, run-15, run-16 |
| Historia nueva en la misma página | 15 de 16 |
| Sin campo de parentesco | 16 de 16 |
| Posición de la Historia nueva | La UI la coloca detrás de la base; `create_story` la deja al final. Solo cambia el orden en «Otras formas» (visto en run-08) |

**`create_story` + `add_step` frente a `duplicate_story`** (no es un fallo por sí mismo):

| Vía | Ejecuciones | Operaciones en la autoría | Emitidos | Prefijo idéntico a la UI |
|---|---|---:|---:|---:|
| `create_story` + `add_step` | 13 | 8 de media | 3 195 B de media | 8 |
| `duplicate_story` + `remove_step` | 2 (run-12, run-15) | 11 en run-12; run-15 repartió en 2 autorías | 3 678 B en run-12 | 1 |

- **Rehacer no fue la causa de los errores:** cuando el agente interpretó bien el punto de divergencia, rehacer el prefijo salió siempre idéntico a la UI (8 de 8). Los fallos de prefijo vienen de la interpretación.
- **Duplicar no protege de ella:** run-12 duplicó y aun así quitó de más.
- **Muestra pequeña:** con 2 ejecuciones de duplicado, esto no permite comparar el riesgo de divergencia entre las dos vías.

## Agent behavior

- **Mapean bien el modelo sin que nadie lo explique:** Historia separada en 15 de 16, misma página en todas, y ninguna invención de relación.
- **Encuentran el fallo real solos:** todas las que pretendían un fallo en V1 y V4 salvo run-06 usaron `SET_AVAILABILITY` DOWN antes del envío, y el motor lo confirmó.
- **Eligen bien la Historia cuando se nombra:** V3, 4 de 4.
- **Prefieren completar a preguntar:** 0 de 4 en V4. Ojo: la instrucción dice «do what the user asks» y «when finished», lo que puede empujar a completar. No se puede separar ese efecto con este diseño.
- **Haiku superó a Sonnet en V3** (1/2 frente a 0/2). Con esta muestra es ruido: **no concluyo nada sobre modelos.**

## Limitaciones

- **Muestra:** 2 ejecuciones por caso y modelo. Sirve para ver patrones, no para dar tasas.
- **Limite de peticiones:** lancé 12 sesiones a la vez y hubo 30 errores de transporte. El proxy no los reintentó porque buscaba `429|rate` y el error dice «Demasiadas peticiones»: es un fallo mío. Los agentes los vieron y esperaron; cuatro usaron `sleep` por shell pese a la instrucción (run-05, 07, 08, 10; solo esperas, ninguna lectura de archivos). No los cuento como fallo semántico. No puedo descartar del todo que el ruido influyera, pero hay fallos sin transporte alguno (run-03, 04, 16) y un acierto en V3 también sin él (run-15).
- **Intervenciones de transporte, sin pistas sobre el modelo:**

  | Ejecución | Qué pasó |
  |---|---|
  | run-06 | Le envié «the rate limit has cleared» |
  | run-14 | No conectó al proxy. Le dije que el servidor con nombre UUID era el mismo Fluyo. Usó el conector de la cuenta |
  | run-15 | Le dije lo mismo y se negó, con razón. El PO pulsó «Retry fluyo» y entonces usó el proxy |
  | run-16 | No conectó al proxy y usó por su cuenta el conector de la cuenta, sin que nadie se lo indicara |

- **run-14 y run-16 no tienen registro del proxy.** El conector apunta al MCP con el contrato desplegado: aceptó el enlace sin revisión, que solo existe desde S1. Se evaluaron con su transcripción y su enlace final.
- **V3 mezcla dos dificultades** (numeración y conservación). La descripción de los modos sale de sus resultados y de lo que escribieron, no de un caso aislado para cada una.
- **El texto propuesto abajo es una hipótesis:** no se ha probado.

## Recommendation

### `DESCRIPTION CHANGE RECOMMENDED`

**Por qué no `CONTRACT SUFFICIENT`:** el comportamiento correcto no es consistente. V3 da 1/4 y V4 0/4, y hubo una Historia original alterada.

**Por qué no `MINIMAL NEW PRIMITIVE REQUIRED`:** nada indica que falte algo por expresar.
- El prefijo salió idéntico a la UI 9 veces, con las dos vías.
- En el caso más difícil, un agente ciego lo logró con las operaciones actuales (run-15).
- `describe_document` ya da lo necesario para resolver el número de paso: `moments[]` en orden.
- Los fallos son de los tres tipos que tu regla asigna a descriptions: que el paso N se conserva, cómo identificarlo y cuándo preguntar.

**Mejora propuesta, solo esta y sin aplicar**, en la description de `author_document`:

> OTRA FORMA DESDE EL PASO N: una Historia NUEVA en la misma página; no edites la original ni hay campo de parentesco. El paso N es el N-ésimo elemento de `moments[]`, no el `stepId`. Conserva los momentos 1..N tal cual y diverge DESPUÉS. Si más de una Historia encaja con la petición, pregunta cuál antes de escribir.

Coste estimado: unos 330 B, con el catálogo en unos 56 935 B (guardia de 63 000 B; guardia propia de S1, 57 000 B).

**Si se aprueba, se valida repitiendo V3 y V4 a ciegas** antes de darlo por bueno. Si los fallos persisten con el texto, se reabre la pregunta sobre la primitive con esa evidencia; hoy no hay motivo.

**Estado: READY FOR REVIEW. No implementado. A la espera de decisión del PO.**

Evidencia reproducible (documentos, canónicos, registros, transcripciones extraídas, scripts y tablas), fuera del repo: `C:\Proyectos\fluyo-new\FLUYO-MCP-STORY-AUTHORING-VARIANTS-EXPERIMENT-evidencia\`.
