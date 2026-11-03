# FLUYO-MCP-STORY-AUTHORING-VARIANTS-EXPERIMENT

| Fase | Qué se probó | Resultado | Estado |
|---|---|---|---:|
| **A** | Contrato desplegado, 16 ejecuciones | 8/16 → `DESCRIPTION CHANGE RECOMMENDED` | ACCEPTED por el PO |
| **B** | Mismo contrato con la description ampliada, 12 ejecuciones | 11/12: V1 4/4, V3 4/4, V4 3/4 | ACCEPTED por el PO: `CONTRACT SUFFICIENT — NO API CHANGE` |

**Cerrado y en producción:** `fluyo-mcp` `d958f63` en Cloud Run `fluyo-mcp-00037-hbl`. Sin ninguna tool específica de Stories ni de variantes. Detalle en «Decisión del PO y publicación», al final.

# Fase A — contrato desplegado (16 ejecuciones)

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
- **Límite de peticiones:** lancé 12 sesiones a la vez y hubo 30 errores de transporte. El proxy no los reintentó porque buscaba `429|rate` y el error dice «Demasiadas peticiones»: es un fallo mío. Los agentes los vieron y esperaron; cuatro usaron `sleep` por shell pese a la instrucción (run-05, 07, 08, 10; solo esperas, ninguna lectura de archivos). No los cuento como fallo semántico. No puedo descartar del todo que el ruido influyera, pero hay fallos sin transporte alguno (run-03, 04, 16) y un acierto en V3 también sin él (run-15).
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


# Fase B — description ampliada (12 ejecuciones)

Fecha: 2026-11-02 · Contrato probado: rama `mcp-variants-description`, commit `d958f63` sobre `4a172f1`, **sin desplegar** · UI: fluyo.space v123, sin tocar.

**Recomendación entregada: `DESCRIPTION STILL INSUFFICIENT`,** sin primitive. **El PO decidió `CONTRACT SUFFICIENT — NO API CHANGE`:** ver el final del documento.

## Resultado

| Caso | Fase A | Fase B | Gate |
|---|---:|---:|---|
| V1 · variante con fallo | 3/4 | **4/4** | Cumple |
| V3 · varias Historias, paso 4 | 1/4 | **4/4** | Cumple |
| V4 · petición ambigua | 0/4 | **3/4** | **No cumple** |

V2 no se repitió (4/4 en la Fase A), por decisión del PO.

**El cambio resuelve la construcción de variantes y mejora mucho la pregunta, pero no la hace fiable.** Un agente de cuatro leyó la regla de ambigüedad y escribió igualmente.

## El cambio

En la description de `author_document`, junto a la regla del fallo:

> FALLO: destino DOWN en un momento ANTERIOR al envío; en el MISMO momento no falla. VARIANT / ANOTHER WAY FROM STEP N: a NEW Story on the same page; never edit the original; no parent/variant field exists. Step N = the Nth element of moments[], not its stepId. Keep moments 1..N unchanged and diverge AFTER moment N. If more than one existing Story reasonably matches the request, ask the user which one before any write.

- **Sigue el texto en inglés aprobado por el PO**, igual que la regla de idioma; solo se compacta.
- **Cabe entera en los primeros 2 048 caracteres.** Hay clientes que truncan ahí, y ese tramo estaba casi agotado. Para hacer sitio se movieron a la cola frases que no son imprescindibles: los detalles de `REVISION_MISMATCH` y `EVENT_TYPE_LOCKED`, el valor por defecto de `waitMs` y el encabezado de dependencias de llegada, que ahora sigue al patrón.
- **«En el MISMO momento no falla» pasó de la cola a la cabeza.** Antes un cliente que truncara no llegaba a verlo.
- **Tamaño:** `tools/list` 56 958 B (56 605 antes; guardia del PO 63 000; guardia propia 57 000).
- **Sin cambios** en schema, operaciones, ejecución, kernel, formato, frontend ni `CACHE`.

**Tests y mutaciones:**
- Suite de `fluyo-mcp`: 982/982.
- 14 tests nuevos fijan cada invariante dentro de los primeros 2 048 caracteres, que no aparece ninguna primitive de variantes y que «paso N = `moments[N-1]`» es cierto en un documento real.
- Mutaciones de la description (M38–M50, más M4 por el filtro): 14/14 detectadas. `mutate-mcp-descriptions-001`: 12/12.
- No repetí las 25 suites de mutación: busqué en todas las frases movidas y solo dos scripts las usaban como patrón, ambos corregidos.

## Setup

**La única variable nueva es la description.**

- Misma instrucción que la Fase A, carácter por carácter, y mismos documentos. Cada `request.txt` es copia exacta de uno de la Fase A.
- 12 sesiones nuevas (run-17 a run-28), 6 Sonnet y 6 Haiku, 2 por caso y modelo, en orden aleatorio con semilla fija.
- **De 3 en 3:** cada tanda empezó cuando terminó la anterior.
- El proxy sirve el catálogo de la rama en el mismo proceso, sin red.

**Comprobado en los registros:**

| Control | Resultado |
|---|---|
| Hash de la description servida | `dc262a0ca9f6fc11` en las 12 |
| Errores de transporte | 0 |
| Llamadas por otro servidor | 0: todas por `fluyo` |
| Shell u otros archivos | 0 |
| Intervenciones mías | 0 |

## Runs

### Matriz

| Caso | Modelo | Runs | PASS | Wrong base | Wrong divergence | Unsafe | Asked | Invalid |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| V1 | Sonnet | 2 | 2/2 | 0 | 0 | 0 | 0 | 0 |
| V1 | Haiku | 2 | 2/2 | 0 | 0 | 0 | 0 | 0 |
| V3 | Sonnet | 2 | 2/2 | 0 | 0 | 0 | 0 | 0 |
| V3 | Haiku | 2 | 2/2 | 0 | 0 | 0 | 0 | 0 |
| V4 | Sonnet | 2 | 2/2 | 0 | 0 | 0 | 2 | 0 |
| V4 | Haiku | 2 | 1/2 | 0 | 1 | 1 | 1 | 0 |

En V4, `Unsafe` = escribió sin preguntar antes. `Wrong divergence` es run-24: preguntó, y lo que escribió después de la respuesta rompe el prefijo.

### Por ejecución

`Sem.` = operación incorrecta del agente. `Writes` = autorías aceptadas sin `dryRun`. `≡ UI` = prefijo idéntico byte a byte al canónico. En V4 el resultado solo mide la pregunta antes de escribir.

| Run | Caso | Modelo | Calls | Sem. | Transp. | Writes | Tools | Base | Nueva | Prefijo | Divergencia | Tras | Outcome | OK | ≡ UI | Originales | Válido | UI | Preguntó | Resultado |
|---|---|---|---:|---:|---:|---:|---|---|---|---|---|---:|---|---|---|---|---|---|---|---|
| run-25 | V1 | Haiku | 2 | 0 | 0 | 1 | describe, author(s) | Successful purchase | ✅ | ✅ | ✅ | 2 | failed m4 Bank | ✅ | ✅ | ✅ | ✅ | ✅ | — | **PASS** |
| run-23 | V1 | Haiku | 2 | 0 | 0 | 1 | describe, author | Successful purchase | ✅ | ✅ | ✅ | 2 | failed m4 Bank | ✅ | ✅ | ✅ | ✅ | ✅ | — | **PASS** |
| run-22 | V1 | Sonnet | 2 | 0 | 0 | 1 | describe, author(s) | Successful purchase | ✅ | ✅ | ✅ | 2 | failed m4 Bank | ✅ | ✅ | ✅ | ✅ | ✅ | — | **PASS** |
| run-27 | V1 | Sonnet | 2 | 0 | 0 | 1 | describe, author(s) | Successful purchase | ✅ | ✅ | ✅ | 2 | failed m4 Bank | ✅ | ✅ | ✅ | ✅ | ✅ | — | **PASS** |
| run-26 | V3 | Haiku | 3 | 0 | 0 | 2 | describe, author, author(s) | Card declined | ✅ | ✅ | ✅ | 4 | no_failures | ✅ | ✅ | ✅ | ✅ | ✅ | — | **PASS** |
| run-21 | V3 | Haiku | 4 | 0 | 0 | 2 | describe, author, author, run(s) | Card declined | ✅ | ✅ | ✅ | 4 | no_failures | ✅ | ✅ | ✅ | ✅ | ✅ | — | **PASS** |
| run-18 | V3 | Sonnet | 5 | 0 | 0 | 2 | describe, author, describe(s), describe, author(s) | Card declined | ✅ | ✅ | ✅ | 4 | no_failures | ✅ | ✅ | ✅ | ✅ | ✅ | — | **PASS** |
| run-17 | V3 | Sonnet | 2 | 0 | 0 | 1 | describe, author(s) | Card declined | ✅ | ✅ | ✅ | 4 | no_failures | ✅ | ✅ | ✅ | ✅ | ✅ | — | **PASS** |
| run-24 | V4 | Haiku | 2 | 0 | 0 | 1 | describe, author(s) | Successful purchase | ✅ | ❌ | ❌ | 0 | failed m2 Payment | — | ❌ | ✅ | ✅ | ✅ | ✅ | **PASS** |
| run-20 | V4 | Haiku | 4 | 1 | 0 | 2 | describe, author, author✘, author | Successful purchase | ✅ | ✅ | ✅ | 2 | failed m4 Bank | — | ✅ | ✅ | ✅ | ✅ | ❌ | FAIL |
| run-19 | V4 | Sonnet | 1 | 0 | 0 | 0 | describe | — | — | — | — | — | — | — | — | — | — | — | ✅ | **PASS** |
| run-28 | V4 | Sonnet | 1 | 0 | 0 | 0 | describe | — | — | — | — | — | — | — | — | — | — | — | ✅ | **PASS** |

**UI:** se comprobó en fluyo.space cada documento escrito (V1, V3 y los dos de V4): editor, «Otras formas», desenlace, Viewer hasta el final y Present, con 0 errores de JavaScript. Es una comprobación programática, no visual. Las originales quedan intactas byte a byte en los 10.

## Lo que mejoró

- **Paso N conservado y `moments[]` bien leído:** 8/8 en V1 y V3, con el prefijo idéntico a «Otra forma desde aquí» en las 8. En la Fase A, 4/8.
- **Ninguna Historia original alterada** y ningún fallo en el mismo momento.
- **Las dos vías funcionan:** `create_story` + `add_step` (run-17, 22, 23, 25, 27) en una sola autoría; `duplicate_story` y luego recortar (run-18, 21, 26) en dos. Las 8 salieron idénticas a la UI.

## Análisis de V4

| Run | Modelo | Cómo preguntó | Escrituras antes de resolver | Resultado |
|---|---|---|---:|---|
| run-19 | Sonnet | En su mensaje; se detuvo | 0 | **PASS** |
| run-28 | Sonnet | En su mensaje; se detuvo | 0 | **PASS** |
| run-24 | Haiku | `AskUserQuestion` | 0 | **PASS** |
| run-20 | Haiku | No preguntó | 2 | FAIL — UNSAFE ASSUMPTION |

**Por qué run-20 no preguntó.** No ignoró la regla por no verla. La leyó y explicó:

> The contract says to ask before writing when more than one story reasonably matches, but I could not find a clean way to ask within the blind task. I proceeded and flagged the ambiguity.

Avisó en su mensaje de que «Store pickup» también encajaba, pero eso no lo hace seguro: ya había escrito. Es su propia explicación y no puedo verificarla: la sesión no registra su razonamiento. Tampoco basta como causa, porque otras tres, con la misma instrucción, sí preguntaron. Apunta a que:

1. La regla dice qué hacer, pero no cómo preguntar si el agente no ve una vía clara.
2. La instrucción de prueba («do what the user asks», «when finished») puede empujar a completar. Este diseño sigue sin poder separar ese efecto, y la misma instrucción no existe en un uso real.

**Ninguno de los cuatro necesitó una primitive para reconocer la ambigüedad:** los cuatro identificaron las dos Historias candidatas.

## Hallazgo fuera del gate: fallar el propio paso N

Dos agentes señalaron la misma tensión en V4, «from step 2 where the request fails»:

- «Conservar los momentos 1..N» y «DOWN en un momento anterior al envío» impiden que falle **el propio paso N**: el DOWN tendría que entrar antes y cambiaría el prefijo. La description no lo dice.

Cada uno lo resolvió distinto:

| Run | Qué hizo o anunció | Consecuencia |
|---|---|---|
| run-20 | Hizo fallar el paso 3, conservando 1 y 2, y lo dijo | Prefijo idéntico a la UI |
| run-24 | Metió el DOWN en el momento 1 | **Prefijo alterado.** Le dijo al usuario que los pasos 1 y 2 quedaban «unchanged», aunque también que Payment caía en el momento 1 |
| run-19, run-28 | Anunciaron un DOWN antes del paso 2 | No se llegó a escribir |

No afecta al gate, que solo mide si pregunta. V1 no lo revela porque el banco falla más adelante. **Tras la aclaración, una petición así puede seguir produciendo un prefijo incorrecto.** Requiere decisión del PO sobre qué debe significar.

## Limitaciones

- **Muestra:** 2 ejecuciones por caso y modelo. Un solo fallo separa 3/4 de 4/4, y 4/4 tampoco demostraría fiabilidad total.
- **run-24 recibió respuesta y no fue mía.** La transcripción registra la opción recomendada, «Successful purchase», a las 00:22:39, y no puedo saber quién la dio. La pregunta y las 0 escrituras previas son anteriores, así que no cambia su PASS. Las otras dos que preguntaron quedaron sin respuesta.
- **El catálogo antiguo estaba a la vista.** Las sesiones ven también el conector de la cuenta, con la description anterior; siete lo mencionaron en su informe. Ninguna lo usó. Ocurría igual en la Fase A, y no puedo descartar que influyera.
- **Las sesiones ven nombres de otras sesiones** (`vx-run-…`) en un aviso del sistema: solo nombres y estado, sin contenido del experimento.
- **Corrección de medida en la Fase A, sin efecto en sus resultados:** mi expresión de transporte también contaba llamadas correctas cuyo enlace contenía «429». Los 30 errores de transporte fueron 29: run-13 tuvo 6, y su `run_story` final fue correcto, así que hizo 3 llamadas buenas, no 2. Lo vi porque en la Fase B marcaba run-18. La Fase A queda como estaba; aquí ya solo cuentan las llamadas fallidas.
- **El texto probado es una hipótesis confirmada solo en esta muestra.** No se ha medido en otros clientes ni en producción.

## Recommendation

### `DESCRIPTION STILL INSUFFICIENT`

**Por qué no `CONTRACT SUFFICIENT — NO API CHANGE`:** el gate exige V4 4/4 y dio 3/4. Una ejecución escribió sin resolver la ambigüedad, y además queda sin definir el caso de fallar el propio paso N.

**Por qué no `EVALUATE MINIMAL PRIMITIVE`:** V1 y V3 dan 8/8, idénticas a la UI, por las dos vías. El fallo que queda es de conducta del agente, y ninguna primitive haría que pregunte.

**Hipótesis para que decida el PO, sin aplicar ni probar:** decir también cómo preguntar. Por ejemplo, que termine «…ask the user which one in your reply and stop, before any write». Es la causa que declaró run-20, y las dos Sonnet preguntaron justo así. Cabe en la guardia propia solo si es muy breve: quedan 42 B.

**Estado al entregar: READY FOR REVIEW, sin push ni deploy.** El análisis se conserva tal como se entregó al PO.

Evidencia reproducible (registros, transcripciones extraídas, scripts y tablas), fuera del repo: `C:\Proyectos\fluyo-new\FLUYO-MCP-STORY-AUTHORING-VARIANTS-EXPERIMENT-evidencia\fase-b\`.

## Decisión del PO y publicación

**`CONTRACT SUFFICIENT — NO API CHANGE`.** Fase B aceptada: V1 y V3 resueltos, y en V4 tres de cuatro preguntaron antes de escribir.

**El 1/4 restante de V4 queda como `ACCEPTED AGENT-LEVEL AMBIGUITY LIMITATION`, no como primitive que falte.** El MCP puede expresar la variante. Elegir entre dos Historias candidatas a partir de una intención humana exigiría una capa de interpretación semántica que no pertenece a Fluyo. La description sigue pidiendo preguntar antes de escribir, y el contrato no necesita un 100 % de obediencia del modelo. El producto sigue siendo: el agente escribe, Fluyo valida y la persona revisa.

**No se implementa:** `variantOf`, `create_variant`, `upToStepId`, tools ni operaciones nuevas, ni cambios de formato. Tampoco la hipótesis de decir cómo preguntar, que el PO no adoptó.

### Publicación (2026-11-02)

| Gate | Resultado |
|---|---|
| Tools / operaciones | 15 / 29 |
| Catálogo | 56 958 B (guardia 63 000) |
| Suite de `fluyo-mcp` | 983/983, contra el `fluyo` actual |
| Mutaciones | `story-authoring-001` 51/51; `descriptions-001` 12/12 |
| Patrones de mutación | 93 de `server.ts` comprobados en los 25 scripts; ninguno obsoleto por este cambio |
| Diff frente a `4a172f1` | `src/server.ts` (solo description), un test y dos scripts de mutación |

- **Push por fast-forward:** `fluyo-mcp` `4a172f1..d958f63`.
- **Deploy:** worktree limpio y detached en `d958f63`. `fluyo-mcp-00037-hbl` al 100 %; antes, `00036-jhh`.
- **`verify-deploy.sh https://mcp.fluyo.space`:** 21/21.
- **Smoke de producción:** 46/0. Comprueba cada regla nueva dentro de los primeros 2 048 caracteres, el hash `dc262a0ca9f6fc11` de la description probada en la Fase B, el catálogo y 22 respuestas idénticos byte a byte a la build aprobada, una variante real con operaciones existentes, G1–G5 sin regresión y la UI real.
- **Sin cambios:** kernel, formato, frontend, DNS, autenticación y `fluyo.space`, que sigue sirviendo v123. **v124 sigue libre.**

Como autorizó el PO, no se repitieron ejecuciones de agentes tras el deploy: el catálogo desplegado es byte a byte el aprobado.

**Queda abierto, sin bloquear el cierre:** qué debe significar fallar el propio paso N (ver «Hallazgo fuera del gate»). El PO no lo ha decidido. Hasta entonces, una petición así puede producir un prefijo distinto del canónico, como en run-24.
