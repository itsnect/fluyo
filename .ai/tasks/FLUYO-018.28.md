# FLUYO-018.28 — MCP: autoría de Historias temporalmente coherentes

Estado: **READY FOR COMMIT** (solo `fluyo-mcp` cambia código: descripciones, README y un test; en `fluyo` solo `.ai/`). Base: fluyo `21d0f0d` (018.27), fluyo-mcp `72f6709`. Sin commit, push ni deploy. `CACHE` no cambia (no se toca nada del navegador). Kernel idéntico (`check:kernel` ✔, `KERNEL_ID` sin cambios).
Fecha: 14 de octubre de 2026.
Owner/agente actual: libre.

> Repo público: solo contenido técnico del proyecto open source.
> Contexto leído: `AGENTS.md`, `.ai/ARCHITECTURE.md`, `.ai/DECISIONS.md` (168–199), `FLUYO-018.21.md`, `FLUYO-018.22.md`. Código: `js/story-clock.js` (horario visible), `js/scenario-playback.js` (`MOTION_MS`), `js/story-authoring.js` (`add_step`, `set_wait`, `set_arrival_dependencies`), `js/model.js` (regla de llegada); en el MCP `src/authoring.ts` (schema), `src/server.ts` (descripciones), `src/stories.ts` (`describe_document`, `UNMODELED`), `README.md`, `test/fluyo-018-22.test.ts`.

## Objetivo

Comprobar, desde el punto de vista de un agente que solo descubre las tools, si `waitMs` + `waitsForArrivalOf` (018.21/018.22) bastan para que el MCP construya Historias en las que ningún evento narrativo se vea antes de que llegue visualmente el mensaje del que depende; y, si la capacidad existe pero el contrato no la hace descubrible, hacer el cambio mínimo de documentación. Sin geometría, UI, Playback, Story Clock, semántica de `waitMs` ni abstracción temporal nueva.

## 1. Reproducción del problema original (números reales)

Documento creado ENTERO por el MCP (`author_document` sobre un documento vacío): A → B → C (conexiones 5 A→B, 6 B→C), evento «Petición» FLOW `motion:"normal"` (viaje visual 1100 ms = `MOTION_MS.normal`), «Procesa» OCCURRENCE. Reproducido con el editor real (`FluyoStoryClock.start` + `FluyoScenarioPlayback.tick` a 1 ms, `fluyo/js` en `vm`). Script: `scratchpad/diag-018-28.mjs` (2,2 s); los mismos números están fijados en `fluyo-mcp/test/fluyo-018-28.test.ts`.

### 1a · Como lo haría un agente que solo conoce `waitMs` (cree que 500 ms «dan tiempo» a llegar)

| Paso | Acción | `at` narrativo | Instante visible | Viaje | Llega en | En vuelo al verse | ¿Se adelanta? |
|---|---|---|---|---|---|---|---|
| 1 | A SEND B | 0 | 0 | 1100 | **1100** | — | no |
| 2 | B procesa | 500 | **500** | — | — | 1→1100 | **SÍ, 600 ms antes** de que llegue A→B |
| 3 | B SEND C | 1000 | 1000 | 1100 | **2100** | 1→1100 | sí, 100 ms (B envía con el token de A aún en vuelo) |
| 4 | C procesa | 1500 | **1500** | — | — | 3→2100 | **SÍ, 600 ms antes** de que llegue B→C |

Con el `waitMs` por defecto (1000, sin escribir nada): momentos 0 → 1000 → 2000 → 3000; B y C procesan **100 ms antes** de la llegada (1000 < 1100). El defecto tampoco salva.

### 1b · La misma Historia, mismos `waitMs`, con `waitsForArrivalOf`

| Paso | Acción | `at` narrativo | Instante visible | Llega en | `waitsForArrivalOf` | ¿Se adelanta? |
|---|---|---|---|---|---|---|
| 1 | A SEND B | 0 | 0 | 1100 | — | no |
| 2 | B procesa | 500 | **1100** | — | [1] | no |
| 3 | B SEND C | 1000 | 1600 | 2700 | — | no |
| 4 | C procesa | 1500 | **2700** | — | [3] | no |

Momentos: 0 → 1100 → 1600 → 2700 (`shifted:true`). El Trace del motor (`run_story`) es **idéntico** en 1a y 1b: solo cambia cuándo se VE cada momento. `describe_document` lo muestra: `moments[1].waitsFor=[1]`, `moments[3].waitsFor=[3]`.

**Conclusión del punto 1:** 018.21/018.22 resuelven el problema. El error original no era de capacidad sino de autoría: usar `waitMs` como si fuera «lo que tarda en llegar el mensaje».

## 2. Auditoría del MCP como API para un agente (antes de cambiar nada)

Lo que un agente recibe en `tools/list` (schema real generado por zod) y en las descripciones:

| Qué ve | Estado en HEAD | ¿Basta? |
|---|---|---|
| `add_step.waitMs` en el schema | `{"type":"integer","minimum":0,"maximum":86400000}` — **sin `description`** | No: nada dice desde dónde se cuenta ni que no incluye el viaje |
| `set_wait.waitMs` | igual, sin descripción | No |
| `waitsForArrivalOf` (schema) | «su momento no empieza (al reproducir en Fluyo) hasta que llegue el token de ese envío… Nunca se infiere de las conexiones» | Semántica correcta y clara; **falta cuándo usarlo** y que `waitMs` no lo sustituye |
| `author_document.description` | «El tiempo es narrativo: add_step añade al final tras 'waitMs'…»; «set_wait lo cuenta desde el momento anterior y desplaza los posteriores» | Parcial: «tras waitMs» no dice tras QUÉ (un agente lee «tras terminar lo anterior», que para un SEND incluye el viaje) |
| Duración del viaje | `describe_document` da `motion:"normal"` (palabra), ningún texto da ms | Un agente con solo `waitMs` **no puede** calcular la espera; con `waitsForArrivalOf` **no necesita** calcularla, pero nadie se lo dice |
| Caso D (evento sobre el nodo destino) | solo «nunca se infiere de las conexiones» | No explícito en términos de nodos/recepción |
| `unmodeled` | «no son latencia ni se infieren de las conexiones» | Correcto; no dice qué pasa SIN dependencia |
| README | bullets de tiempo narrativo y dependencias; sin ejemplo de Historia | Sin patrón ni ejemplo correcto/incorrecto |
| `run_story` | Trace del motor; no expone instantes visibles (por diseño, 018.22) | Correcto; no es el sitio |
| Warnings | `ARRIVAL_DEPENDENCY_INACTIVE` (move/set_wait) | Correcto; no hay (ni debe haber) aviso de «paso tras SEND sin dependencia» |

Respuesta a la pregunta concreta: **un agente que solo descubre las tools NO puede saber que `waitMs` no es «cuánto tarda en llegar»** (el campo no tiene descripción y nada lo niega), y entiende `waitsForArrivalOf` correctamente si lo lee, pero nada lo lleva a usarlo para una recepción. Es un problema de contrato, no de capacidad.

## 3. Decisión: capacidad suficiente, contrato insuficiente → cambio mínimo de documentación (dec. 200)

- La API se conserva tal cual: `waitMs` + `waitsForArrivalOf`. **Sin** `arrivalMs`, `latency`, `dependsOn`, `after`, `causedBy`, eventos de llegada, estados causales ni otro reloj (el test lo comprueba sobre el schema publicado).
- Descartado exponer duraciones de viaje en `describe_document`: invitaría a calcular `waitMs` en vez de declarar la dependencia. Se citan en texto (500/1100/1800) solo para que el agente entienda la magnitud, con un test que las compara con `FluyoScenarioPlayback.MOTION_MS` del kernel (si cambian, el test avisa de que la frase miente).
- Descartado un aviso heurístico «paso tras un SEND sin dependencia»: sería inferir causalidad (contra 018.21/018.22) y daría falsos positivos legítimos (caso B: «X cae mientras viaja el token»; caso C: segundo envío con el primero en vuelo).
- Sin cambios en el kernel ni en `fluyo/js`: `check:kernel` ✔, `KERNEL_ID` igual, `CACHE` igual.

## 4. Casos que debe poder expresar el MCP (todos medidos con el editor real)

| Caso | Lote | Visible | Resultado |
|---|---|---|---|
| A · cadena | 1b | 0 → 1100 → 1600 → 2700 | ✔ B espera A→B, C espera B→C |
| B · independiente | A SEND B (0) · X cae (500) · B procesa (600, espera A→B) | 0 → **500** → 1100 | ✔ X cae a su hora con el token en vuelo: nada lo bloquea sin dependencia |
| C · dos llegadas | A→B (0) · A→C (300) · C procesa (400, espera ambas) | 0 → 300 → **1400** | ✔ empieza con la última llegada (A→C llega en 1400) |
| D · mismo nodo sin causalidad | A SEND B (0) · evento sobre B (200, sin dependencia) | 0 → **200** | ✔ se ve a los 200 ms, 900 ms antes de la llegada: NO es una recepción y el MCP no lo convierte en una |
| E · envío que falla | B cae (0) · A SEND B (300) · momento que espera ese envío (400) | 0 → 300 → **1400** | ✔ `run_story`: `send_started` + `send_failed` (`target_down`) en 300, nada más; el fallo se ve en B en 1400 y ahí empieza el dependiente. Sin reintento, cola ni entrega posterior |

## 5. Prueba realista de agente: «un productor envía a Kafka, Kafka cae, deja de recibir, vuelve y el flujo continúa»

Diagrama por el MCP: Productor →(produce)→ Kafka →(consume)→ Consumidor. Eventos: Publica (FLOW normal), Entrega (FLOW normal), Procesa (OCCURRENCE), Cae (SET_AVAILABILITY DOWN), Vuelve (SET_AVAILABILITY UP). Lote aceptado **sin warnings**; `editorUrl` válido. Fijado en `fluyo-018-28.test.ts` (§5).

| Momento | Paso(s) | `waitMs` | `waitsForArrivalOf` | Por qué |
|---|---|---|---|---|
| M1 | Productor publica (msg 1) | 0 | — | arranque |
| M2 | Kafka procesa · Kafka entrega al consumidor (mismo momento, `placement`) | 500 | **[M1]** | es la consecuencia de la llegada del msg 1 |
| M3 | Consumidor procesa | 500 | **[entrega M2]** | consecuencia de la entrega |
| M4 | Kafka cae | 800 | — | independiente: no depende de ninguna llegada |
| M5 | Productor publica (msg 2) | 500 | — | el motor lo marca `not_completed: target_down`; se ve el fallo en Kafka 1100 ms después |
| M6 | Kafka vuelve | 1500 | — | decisión del autor (Fluyo no recupera nada solo) |
| M7 | Productor publica (msg 3) | 500 | — | |
| M8 | Kafka procesa · entrega | 500 | **[M7]** | |
| M9 | Consumidor procesa | 500 | **[entrega M8]** | |

Visible: 0 → 1100 → 2200 → 3000 → 3500 → 5000 → 5500 → 6600 → 7700; ninguna recepción se adelanta a su envío; caída/vuelta conservan su ritmo. `run_story`: 1 completed · 2 narrated · 3 completed · 4 narrated · 5 state_changed · **6 not_completed (target_down)** · 7 state_changed · 8 completed · 9 narrated · 10 completed · 11 narrated.

**Lo que el agente NO puede inferir y debe decidir él** (y el contrato ahora lo dice): que «Kafka procesa» es consecuencia del envío (hay que declararlo); cuánto dura el viaje (no hace falta: se declara la dependencia); que msg 2 no se entrega después (no hay cola ni reintento: si quiere mostrar una reentrega, es otro SEND explícito tras «Vuelve»); cuándo vuelve Kafka (un paso SET_AVAILABILITY UP del autor); que el Productor «no sabe» que Kafka cayó (si quiere mostrarlo, es otro evento). Ninguna parte del fixture exige mentir sobre la semántica.

## 6. Tres cosas que no se mezclan

1. **Lo que el MCP puede representar:** momentos narrativos (`waitMs`), «este momento no empieza hasta que llegue visualmente ese SEND» (`waitsForArrivalOf`, varias llegadas = la última), envíos que fallan por destino caído (motor), disponibilidad UP/DOWN explícita.
2. **Lo que un agente entiende desde la API:** ahora, desde el schema y la descripción: `waitMs` = desde el inicio del momento anterior, sin viaje; `waitsForArrivalOf` = cuándo usarlo (recepción/procesamiento/consecuencia de un envío); un paso sobre el nodo destino no es una recepción; un envío fallido también llega.
3. **Lo que Fluyo simula:** nada de Kafka ni servicios reales, ni latencia real, ni colas, ni reintentos, ni recuperación. Representa visualmente la Historia que el autor construye; el motor solo decide completado/fallido por disponibilidad.

## 7. API: cuándo usar cada cosa

- **`waitMs`** (add_step al final; set_wait por momento): separa momentos en tiempo narrativo, contado desde el **inicio** del momento anterior. Úsalo para el ritmo de lo que NO depende de una llegada: otro nodo cae o vuelve, otro envío, una pausa deliberada. Nunca para «dar tiempo a que llegue»: no sabe nada del viaje.
- **`waitsForArrivalOf`** (add_step; set_arrival_dependencies para cambiarlo): el momento del paso empieza cuando llega visualmente ese SEND (o el último de varios). Úsalo en todo paso que narre la recepción, el procesamiento o la consecuencia de un envío. `waitMs` sigue valiendo como mínimo (el momento empieza en `max(at + pausa acumulada, llegadas)`); lo posterior conserva su ritmo.
- **Ejemplo correcto A→B→C** (mismos `waitMs` 0/500/500/500): M2 `waitsForArrivalOf:[M1]`, M4 `waitsForArrivalOf:[M3]` → 0 → 1100 → 1600 → 2700. Incorrecto: sin dependencias → 0 → 500 → 1000 → 1500 con llegadas en 1100 y 2100.

## 8. Limitaciones (lo que Fluyo NO representa, ahora dicho en README y `unmodeled`)

Sin latencia real, sin colas, sin reintentos ni entregas posteriores de un envío fallido, sin recuperación automática, sin deducir recepciones (ni de las conexiones ni del nodo destino), sin instantes visibles en `run_story` (son del reloj, fuera del kernel). `move_step`/`set_wait` pueden dejar una dependencia sin efecto: se conserva y se avisa (`ARRIVAL_DEPENDENCY_INACTIVE`, 018.22).

## 9. Archivos modificados

**fluyo-mcp** (código = solo textos de contrato; `dist/` no está en git: antes de desplegar, `npm run build`)
- `src/authoring.ts` — `Wait` (el schema de `waitMs` de `add_step` y `set_wait`) con descripción: desde el inicio del momento anterior, no incluye ni espera el viaje, remite a la dependencia. `WaitsForArrivalOf`: cuándo usarlo, `waitMs` no espera al token, un paso sobre el nodo destino no es una recepción.
- `src/server.ts` — descripción de `author_document`: `waitMs` vs viaje (500/1100/1800, «no lo uses para calcular»), ejemplo del error (500 → 600 ms antes), PATRÓN A→B→C, independiente no se retrasa, nodo destino ≠ recepción, envío fallido también llega.
- `src/stories.ts` — `UNMODELED`: «sin ellas, waitMs no espera al token y un paso sobre el nodo destino no es una recepción» (misma entrada; las palabras que fija 018.22 se conservan).
- `README.md` — bullets «Tiempo narrativo» y «Dependencias de llegada» + Patrón + lotes Incorrecto/Correcto ejecutables; «Limitaciones actuales»: el tiempo de una Historia lo decide el autor.
- `test/fluyo-018-28.test.ts` — nuevo (18 tests).

**fluyo** (sin código)
- `.ai/tasks/FLUYO-018.28.md` (este), `.ai/DECISIONS.md` (200).

## 10. Pruebas

| Suite | Resultado | Tiempo |
|---|---|---|
| Diagnóstico `scratchpad/diag-018-28.mjs` (reproducción + schema publicado) | tablas de §1, §4, §5 | 2,2 s |
| `fluyo-mcp`: `node --test dist-test/test/fluyo-018-28.test.js` (tras `npm run build:test`, 5,4 s) | **18/18** (reproducción, casos A–E, Kafka, contrato `tools/list`/`unmodeled`/README, lotes del README ejecutables, schema sin claves nuevas, `waitMs` sigue igual) | 0,9 s |
| «Mutación» natural: la misma suite contra el contrato ANTERIOR (antes de editar textos) | 13/18: fallan exactamente los 5 de contrato; pasan los 13 de números | 0,8 s |
| MCP dirigido: `fluyo-018-22` (add_step, set_arrival_dependencies, describe, remove_step, duplicate_step, **paridad con el editor real**), `tools`, `contract`, `fluyo-017-2`, `fluyo-017-3`, `no-esm` | **192/192**, 0 skipped | 1,6 s |
| `npm run check:kernel` | ✔ idéntico a `fluyo/js` | — |

No Chrome (nada del navegador cambia), no baterías históricas, no mutaciones de kernel (no se toca kernel). `git diff --stat` en fluyo-mcp: 4 archivos, +49/−5, sin cambios de EOL.

## Handoff

- **Decisión:** `READY FOR COMMIT`. Un commit en `fluyo-mcp` (src, README, test) y uno en `fluyo` (`.ai/`). Para que el MCP desplegado muestre las descripciones nuevas hace falta `npm run build` + deploy (kernel sin cambios, así que no hay riesgo de desfase con Fluyo).
- **No continuar** con otro slice tras este diagnóstico (petición del owner).

# FLUYO-018.28 — READY FOR COMMIT
