# FLUYO-018.20 — Semántica temporal de las Historias

Estado: READY FOR REVIEW (auditoría + diseño; sin cambios de producto)
Owner/agente actual: libre (pendiente de revisión del owner)

> Repo público: este documento solo contiene análisis técnico del proyecto open source.

## Objetivo

Poder expresar **«este momento no puede hacerse visible antes de que llegue visualmente este token»**, sin retrasar lo que no tiene relación y conservando:

- `at` como tiempo narrativo;
- el momento atómico;
- la duración del token como presentación;
- el motor, el Trace y las Historias existentes;
- el MCP, si es posible.

**No se implementa nada** hasta la aprobación de la § 15.

## Recorrido de la tarea

| Versión | Propuesta | Estado |
|---|---|---|
| v1 | Diagnóstico + avisos y espera por defecto (C′) | Diagnóstico **aprobado**. C′ rechazado: no garantiza la causalidad. |
| v2 | Ventana causal por Step con «llegada» deducida | Rechazada: parte momentos e infiere significado. |
| v3 | Barrera global entre momentos (Modelo 4) | Diagnóstico **aprobado**. Modelo 4 rechazado: introduce causalidad donde no existe. |
| **v4 (esta)** | **Dependencias causales explícitas y aditivas** | Pendiente de revisión. |

Conclusiones heredadas que siguen vigentes:

- el documento **no contiene** información para saber qué es una llegada (v3 § 3);
- el **momento es atómico** (v3 § 4);
- la única llegada demostrable es la del token de un `SEND`.

Prototipos en el scratchpad de la sesión, nunca en el repo:

| Script | Qué hace |
|---|---|
| `diag-018-20.cjs` | Diagnóstico |
| `manual-vs-mcp.cjs` | Editor frente a MCP |
| `causal-proto.cjs` | v2 |
| `moment-proto.cjs` | v3 |
| **`format-probe.cjs`** | v4: dónde puede vivir un dato nuevo |
| **`deps-proto.cjs`** | v4: 21 Historias, 4 modelos, Playback real a 1 ms, 1 s |

---

## 1. Diagnóstico (aprobado; resumen)

- `at`: ms absolutos desde el inicio. Se escribe como espera desde el **inicio** del momento anterior.
- **Motor**: el `SEND` sale y se resuelve en el mismo `at`.
- **Playback**: el token sale en `at` y llega en `at + MOTION_MS[motion]` (500 / 1100 / 1800). Lo demás se ve en su `at`.
- Hay 21 incoherencias en 7 fixtures, también con los valores por defecto. El MCP y el editor generan lo mismo.
- **Causa**: nada relaciona lo que se ve con lo que sigue en vuelo, y **el documento no tiene forma de decir qué momento espera a qué token**.

---

## 2. El modelo actual, inspeccionado

| Pregunta | Respuesta | Evidencia |
|---|---|---|
| ¿Los Steps tienen id estable? | **Sí.** `id` entero único **por Historia**. `nextStepId` nunca baja, ni con undo, y un id borrado **no se reutiliza**. Mover, rotar ranuras, cambiar esperas y unir momentos conservan los ids. | `createStep` (`js/model.js:568`); decisión de 012.1; `format-probe.cjs`: tras borrar el 2, el siguiente Step recibe el 3 |
| ¿Cómo se identifican? | Por `(página, Historia, stepId)`. Duplicar una Historia conserva los ids de sus Steps (son por Historia). | `duplicateScenario` (`js/model.js:556`) |
| ¿Un Step puede referenciar a otro? | **No.** No existe ninguna referencia entre Steps. | `validatePersistedStep` (`js/model.js:469`) |
| ¿Cómo se representa un `SEND`? | `{id, at, action:"SEND", edgeId, eventTypeId?}`. **Origen = `edge.from`, destino = `edge.to`**; no se guardan en el Step. | Motor y model |
| ¿Un token visual se identifica con un Step? | **Sí, sin ambigüedad.** Cada `SEND` produce **un** token, indexado por `stepId` (`activeSends`/`completedSends`). Una conexión **no** identifica un token: puede tener varios `SEND`. | `js/scenario-playback.js:81` |
| ¿Hay referencias internas reutilizables? | `stepId` dentro de la Historia (lo usan `placement.sameMomentAs`, `move_step` y el menú). **Los momentos no tienen identidad**: son grupos derivados por `at` (decisión 27). | `js/story-authoring.js` |
| ¿Se puede añadir un campo al **Step**? | **No de forma aditiva.** El editor actual, el motor actual (`invalid_scenario/extra_fields`) y el MCP actual **rechazan** el documento entero. | `format-probe.cjs` |
| ¿Se puede añadir un campo a la **Historia**? | **Sí.** Ver la tabla siguiente. | `format-probe.cjs` |

Lo que el código **actual** hace con un campo nuevo en la Historia (`format-probe.cjs`):

| Lector actual | Resultado |
|---|---|
| Editor (`projectFromProjectData`) | Lo abre y **lo conserva** al normalizar. |
| Motor | Ejecuta la Historia; el Trace es **idéntico** al de la misma Historia sin el campo. |
| `FluyoIntegrity.validateProject` | Documento válido. |
| MCP (`normalizedProject` + `author_document`) | Lo conserva en `add_step`, `move_step`, `set_wait`, `remove_step`, `duplicate_story` y `rename_story`. |
| Duplicar Historia (editor) | Lo copia; los ids siguen apuntando a los mismos Steps. |
| «Compartir historia» (`#d=`, ida y vuelta) | Lo conserva. |

**Conclusión de la inspección.** Hay **estructura suficiente para alojar** una dependencia:

- ids de Step estables y no reutilizables;
- identidad inequívoca entre un `SEND` y su token;
- un objeto Historia que todos los lectores actuales conservan sin tocarlo.

Pero **no hay información**: nada dice hoy qué momento espera a qué token.

---

## 3. La dependencia mínima

| Alternativa | Precisión | Problema |
|---|---|---|
| **Sobre un Step `SEND`** («espera a que llegue el token del paso N») | **Exacta**: un `SEND` = un token | — |
| Sobre un momento (el que envía) | Ambigua: «todos los tokens de ese momento» | Los momentos no tienen identidad; es expresable como varias dependencias sobre `SEND` |
| Sobre una conexión | Ambigua: una conexión puede tener varios `SEND` en la Historia | No identifica un token |
| Derivada automáticamente | Imposible sin inferir (v3 § 3) | Falsos positivos |

Quién declara:

| Lado dependiente | Por qué |
|---|---|
| **Step** (el único con identidad estable) | La dependencia viaja con el Step si se mueve a otro momento |
| Momento | Sin identidad persistida; anclarlo a `at` se rompe al cambiar una espera |

**Dependencia mínima:** el par **(Step dependiente → Step `SEND`)**, con el significado:

> «El momento del Step dependiente no se hace visible antes de que llegue visualmente el token de ese `SEND`.»

Es **una relación de presentación**: no la ve el motor, no cambia el resultado y no es latencia.

Reglas de validez, comprobadas **al reproducir** y nunca bloqueantes:

| Condición | Si no se cumple |
|---|---|
| Ambos Steps existen en la misma Historia | Se ignora (`step_missing`, `target_missing`) |
| El objetivo es un `SEND` | Se ignora (`target_not_send`) |
| El objetivo está en un momento **anterior** (`at` estrictamente menor) | Se ignora (`target_not_earlier`): en el mismo momento esperaría a su propio token; hacia delante no tiene sentido |

Una dependencia inválida **nunca invalida el documento ni detiene la reproducción**.

**Ciclos: imposibles por construcción.** Solo cuentan las dependencias hacia momentos anteriores. En un ciclo A↔B, una de las dos apunta hacia delante y se ignora (prototipo: caso BAD).

---

## 4. Momento atómico con una sola dependencia

Caso AT: M2 = {A′: X cae, B′: ocurre en D, C′: B recibe}, todos en `at = 500`, y solo C′ declara la llegada de A→B (1100).

| Opción | Resultado | ¿Aceptable? |
|---|---|---|
| Separar C′ (A′ y B′ en 500, C′ en 1100) | Un momento narrativo pasa a ser dos visuales | **No**: rompe la regla |
| Ignorar la dependencia | C′ se ve antes de la llegada | **No**: el problema original |
| **El momento entero espera** (A′, B′ y C′ en 1100) | Un solo momento. Su `at` narrativo no cambia | **Sí, si es explícito** |

**Semántica propuesta:**

- Una dependencia **se declara desde un Step, pero su efecto es el momento**: un momento se hace visible cuando se cumplen **todas** las dependencias de **todos** sus Steps (la unión).
- Por eso declarar una dependencia **es** decir «este momento espera a que llegue X». El editor y el MCP deben presentarla así, a nivel de momento («M2 espera a que llegue *Request* a B»), nunca escondida en un Step.
- Si quien escribe quiere A′ y B′ en 500 y C′ al llegar, **C′ debe ir en otro momento**. Ya se puede hacer hoy con «Mover» o «Cambiar espera»: con cualquier espera mayor que 0, C′ será su propio momento y esperará a su token.

**Dicho claramente:** con el momento atómico, la arquitectura **no permite** que solo C′ espere sin separar el momento. La semántica precisa es «el momento espera a la unión»; para esperas distintas hacen falta momentos distintos.

---

## 5. Qué pasa con los momentos posteriores a uno que espera

Esta es la decisión central. Con momentos atómicos y en orden estricto, si un momento se retrasa más allá del `at` del siguiente, **no se pueden cumplir a la vez** «ningún momento posterior se mueve» y «el orden visible es el narrativo». Hay que elegir:

| Variante | Regla | Momentos anteriores | Momentos posteriores | Orden |
|---|---|---|---|---|
| **E1**: solo se mueve el que declara | `visible(k) = max(at(k), llegadas de sus dependencias)` | Intactos | Intactos (su `at`) | **Se puede invertir** (5 de 21 Historias): un momento posterior se ve antes, o dos se funden |
| **E2**: la Historia **se pausa** en el momento que espera | `visible(k) = max(at(k) + pausa(k−1), llegadas de sus dependencias)`; `pausa(k) = visible(k) − at(k)` | **Intactos** (0 movidos en 21 Historias) | Se desplazan **lo que duró la pausa** y conservan su ritmo | **Siempre estricto** |

En ambas, `llegada(t) = visible(momento de t) + viaje(t)`: la llegada se calcula desde la **salida visible**.

**Recomendación: E2.**

- La dependencia **solo hace esperar al momento que la declara**. Lo que va después no espera nada: sigue con la misma separación que tenía respecto a ese momento, porque la Historia es una secuencia.
- Lo que va **antes** nunca se toca.
- Las Historias **sin** dependencias no se mueven en absoluto. Esta es la diferencia con el Modelo 4, que pausaba ante **cualquier** token.

E1 cumple literalmente «solo se mueve el que declara», pero a cambio rompe el orden de la Historia. Lo dejo como alternativa (D3).

Una variante que «absorbe» la pausa en los huecos siguientes necesita una separación mínima arbitraria y comprime el ritmo que escribió el autor. Descartada.

---

## 6. Cadena A→B→C (at 0 / 500 / 1000 / 1500; viajes de 1100)

CH: M1 A→B · M2 «B recibe» (espera a M1) · M3 B→C · M4 «C recibe» (espera a M3).

| | M1 | M2 | M3 | M4 | arrival A→B | arrival B→C |
|---|---|---|---|---|---|---|
| Hoy | 0 | 500 ✗ | 1000 | 1500 ✗ | 1100 | 2100 |
| E1 | 0 | 1100 | **1000** (antes que M2) | 2100 | 1100 | 2100 |
| **E2** | 0 | **1100** | 1600 | **2700** | **1100** | **2700** |

En E2, el orden de los cálculos es:

1. `arrival(A→B) = 0 + 1100 = 1100`, así que M2 se ve en **1100** (pausa de 600).
2. M3 no declara nada: va a 1000 + 600 = **1600**, para conservar su medio segundo después de M2 y no adelantarlo.
3. `arrival(B→C) = 1600 + 1100 = 2700`.
4. M4 se ve en `max(1500 + 600, 2700)` = **2700**.

¿Se retrasan los eventos independientes intercalados? (CHx: «X cae» en 250, «Y cae» en 1250)

| | X cae (250, **antes** del primer momento que espera) | Y cae (1250, **después** de una pausa) |
|---|---|---|
| E1 | **250** | 1250, pero M3 (1000) se ve antes que M2 (1100): orden roto |
| **E2** | **250: no se retrasa** | 1850 = 1250 + 600, solo por la pausa anterior; conserva su distancia a M3 |
| Modelo 4 (comparación) | **1100: retrasado sin relación** | 2950 |

Con E2, lo independiente **antes** de un momento que espera nunca se retrasa. Lo independiente **después** no espera a ningún token: solo conserva su lugar en la secuencia.

Si el reenvío M3 también declara la llegada de M1 (CHr), el resultado es el mismo: 0 / 1100 / 1600 / 2700. M3 ya estaba después.

## 7. Varios flujos (A→B 500 ms, A→C 1800 ms; M2 = {B recibe, C recibe} en 1000)

| Declaración | M2 visible | Comentario |
|---|---|---|
| Solo «C recibe» declara A→C (MF1) | **1800** | El momento atómico espera a la unión: B también se ve en 1800 |
| Ambos declaran su envío (MF2) | **1800** | Las dos dependencias **coexisten** en el mismo momento; manda la llegada más tardía |
| B y C en momentos distintos (MF3: 1000 y 1001) | B **1000**, C **1800** | La única forma de que cada uno se vea a su llegada |

- ¿Espera a ambos? **Sí**, si lo declaran (o si lo declara el más lento): espera a la unión.
- ¿Al primero? **Nunca.**
- ¿Hacen falta dos dependencias? No para el tiempo (con la del más lento basta), **sí para el significado**: si «C recibe» se mueve a otro momento, «B recibe» conserva la suya.
- ¿Puede cada Step aparecer por separado? Solo en **momentos separados**.

---

## 8. Kafka (Cliente → Producer → Kafka → Consumer)

Ningún evento «es» una recepción por estar sobre un elemento: **solo es una llegada si se declara**.

| Momento | ¿Puede declarar dependencia? | ¿De qué? | ¿Debería por defecto? |
|---|---|---|---|
| M1 Cliente envía (`SEND`) | No lo necesita | — | — |
| M2 Producer envía a Kafka (`SEND`) | **Sí** | La llegada de M1 (reenvío del mismo mensaje) | Solo si el autor dice que es el mismo mensaje |
| M3 Kafka cae (`SET_STATE`) | **Sí** | La llegada de M2 («cae después de recibir») | **No**: por defecto es independiente. Sin declararla, la caída puede verse con el mensaje de M2 aún en vuelo (que el motor resolvió «completado») |
| M4 Consumer deja de recibir | Como `SEND` Kafka→Consumer que falla: no lo necesita. Como `OCCURRENCE`: no hay token del que depender | — | No |
| M5 Kafka vuelve (`SET_STATE`) | **Sí** | La llegada del intento fallido de M4 («vuelve tras el intento») | No |
| M6 Producer vuelve a enviar (`SEND`) | Opcional | — | No |
| M7 Consumer recibe | **Tal como está escrita, no tiene de qué depender**: ningún `SEND` va a Consumer (M6 va a Kafka) | Para que «recibe» sea una llegada, hace falta un `SEND` Kafka→Consumer (M7a) y que M7 declare su llegada | No se infiere |

Números (esperas de 500 ms; todos los viajes de 1100 ms):

| Historia | Momentos visibles | Lectura |
|---|---|---|
| K7 sin dependencias (como hoy) | 0 · 500 · 1000 · 1500 · 2000 · 2500 · 3000 | **Idéntica a hoy**: no se inventa nada |
| K7d [M2→M1, M3→M2, M5→M4] con E2 | 0 · 1100 · 2200 · 2700 · 3800 · 4300 · 4800 | Cada espera declarada se cumple; M4, M6 y M7 solo conservan su ritmo |
| K8 [+ M7a Kafka→Consumer espera a M6; M7 espera a M7a] con E2 | 0 · 1100 · 1600 · 2100 · 2600 · 3100 · 4200 · **5300** | «Consumer recibe» se ve **exactamente** cuando llega el token a Consumer (5300) |

En K8, M3 «Kafka cae» no declara nada y pasa de 1000 a 1600 solo por la pausa de M2. El mensaje de M2 llega a Kafka en 2200: si el autor quiere que caiga «después de recibir», lo declara. **No se infiere.**

---

## 9. Historias existentes

| Pregunta | Respuesta |
|---|---|
| ¿Siguen siendo válidas? | **Sí**: el campo es opcional; ausente = sin dependencias. |
| ¿Se migran? | **No.** |
| ¿Se inventa causalidad? | **No.** |
| ¿Mantienen su comportamiento? | **Exactamente**: sin dependencias, E2 = E1 = hoy. Prototipo: las 3 Historias del repo y K7 dan los mismos instantes que el timeline actual. |
| ¿Se corrige en ellas el problema original? | **No.** Sin información explícita no se puede sin inferir semántica, y eso quedó descartado. Las Historias antiguas conservan las incoherencias del diagnóstico hasta que alguien declare sus dependencias (en el editor o, más adelante, por MCP). **No hay falsa compatibilidad.** |

Una ayuda futura y opcional, fuera de este hito: que el editor **sugiera** («¿“B recibe” ocurre al llegar *Request*?») y que el autor confirme. Nunca sería automático.

## 10. MCP

| Pregunta | Respuesta (verificada con el código actual) |
|---|---|
| ¿Puede expresarlo hoy? | **No.** Ninguna operación escribe ni lee dependencias. |
| ¿Puede quedar como dato interno del documento? | **Sí.** El MCP actual **conserva** el campo en todas sus operaciones (`format-probe.cjs`). |
| ¿Lo rompe algo? | `remove_step` deja una dependencia apuntando a un Step eliminado. Es inofensivo: se ignora. |
| ¿Puede crearlo solo el editor? | **Sí**, en una primera fase, y el MCP lo respeta. |
| ¿Qué haría falta para crearlo por MCP? | Modificar operaciones existentes y añadir una nueva (contrato abajo). Requiere tocar el kernel (`story-authoring.js` y una función pura de validación), sincronizar el MCP y un `KERNEL_ID` nuevo. **No se implementa ahora.** |

Contrato propuesto para una fase posterior (nombres provisionales):

- **`add_step`** + `waitsForArrivalOf?: (StepId | {ref})[]`. `SEND` de un momento **anterior** de la misma Historia. Si no, `INVALID_DEPENDENCY {stepId, arrivalOf, reason}` y se rechaza todo el lote. Con `placement.sameMomentAs`, la dependencia afecta al momento elegido.
- **Nueva operación `set_step_dependencies`** `{scope:"story", pageIndex, storyId, stepId, arrivalOf: [...]}` que **reemplaza** la lista; `[]` la borra.
- **`remove_step`**: quita las dependencias del Step y las que apuntan a él. Lo informa en `changes[].dependenciesRemoved`.
- **`duplicate_step`**: la copia hereda las dependencias del original.
- **`describe_document`**: cada paso lista sus dependencias y cada momento muestra su unión («espera a que llegue …»).
- **`run_story`**: Trace sin cambios. Opcionalmente, el instante visible de cada momento, marcado como presentación.
- `waitMs` sigue igual: un agente puede escribir `waitMs: 500` y declarar la dependencia. La visibilidad la garantiza la reproducción, no la espera.

## 11. Formato: extensión estrictamente aditiva

- **Dónde:** un campo **opcional en la Historia** (Scenario), **no en el Step**: en el Step rompería a todos los lectores actuales (§ 2).
- **Forma** (nombre del campo **no decidido**; candidatos: `waits`, `arrivals`, `causes`):

```json
{ "id": 1, "engineVersion": 2, "name": "…", "nextStepId": 5, "steps": [ … ],
  "<campo>": [ { "step": 2, "arrivalOf": 1 }, { "step": 4, "arrivalOf": 3 } ] }
```

- **Reglas:**
  - Ausente equivale a `[]`.
  - Lista de pares de enteros, en orden canónico y sin duplicados.
  - Los pares con Steps inexistentes se pueden limpiar al normalizar, porque los ids no se reutilizan. Los que apuntan a un momento no anterior **se conservan**: pueden volver a ser válidos si se reordena.
  - Una entrada mal formada se descarta. **Nunca se rechaza el documento por este campo.**
- **Versión:** sigue en `version: 5` y `engineVersion: 2`. Es un campo opcional que los lectores actuales ya conservan, y no cambia el significado de `at`.
- **Compatibilidad en ambos sentidos:**
  - Un documento antiguo se ve exactamente igual.
  - Un documento nuevo en un cliente antiguo (por ejemplo, con el service worker en v78) o en el MCP actual se ve como hoy, sin esperas. Al guardarlo **no pierde** el campo.

---

## 12. Comparación final

| | A. Timeline independiente (hoy) | B. Ventana por Step | C. Ventana por momento (relación inferida) | D. Barrera global (Modelo 4) | **E. Dependencias explícitas (E2)** |
|---|---|---|---|---|---|
| Precisión | Ninguna (19 dependencias incumplidas en el prototipo) | Inferida | Inferida | Total, pero indiscriminada | **Exacta: solo lo declarado** |
| Falsos positivos | — | Sí (inferencia) | Sí (inferencia) | Muchos: mueve momentos sin relación, también **antes** de cualquier dependencia (19 en el prototipo) | **Ninguno**. Solo desplaza lo posterior a una pausa **declarada**, para conservar el orden (10 momentos en el prototipo) |
| Momentos atómicos | ✓ | **✗** | ✓ | ✓ | ✓ |
| Orden estricto | ✓ | ✗ | Según la variante | ✓ | ✓ |
| Compatibilidad | Total | Datos sí; pantalla cambia | Datos sí; pantalla cambia | Datos sí; **pantalla cambia en todas** | **Total: lo antiguo se ve igual** |
| Problema original en Historias nuevas | ✗ | ✓ | ✓ | ✓ | ✓, si se declara |
| … y en Historias antiguas | ✗ | Inferido | Inferido | ✓ (por secuencia) | **✗ (honesto: falta el dato)** |
| Complejidad | Nula | Alta | Media | Baja | **Baja**: un `max` por momento + validar pares |
| Formato | No | No | No | No | **Campo opcional en la Historia** |
| MCP | — | — | — | — | Lo conserva hoy; crearlo requiere contrato (§ 10) |
| Editor | — | Integración | Integración | Integración | Integración + declarar «Espera a que llegue…» |
| Playback | — | Copia del Trace por Step | Copia del Trace por momento | Copia del Trace por momento | **Copia del Trace por momento** |
| Viewer / Present | — | Alto | Instantes visibles | Instantes visibles | **Instantes visibles** (sin dependencias, idénticos a hoy) |

### Recomendación: E (dependencias explícitas, variante E2)

Demostrado con el código y los ejemplos, no supuesto:

1. Es el único modelo **sin inferencias ni falsos positivos semánticos**: solo espera lo que alguien declaró.
2. Conserva `at`, el momento atómico, el orden, el motor, el Trace y la duración como presentación.
3. Es **100 % compatible**: sin dependencias es idéntico a hoy (prototipo).
4. Su dato **cabe** en la estructura actual sin romper ningún lector: Historia, ids de Step estables, `SEND` = token (`format-probe.cjs`).
5. Su límite es honesto: no corrige Historias antiguas mientras nadie declare sus dependencias.

---

## 13. Implementación futura (propuesta de slice; no se implementa)

**Fase 1 (018.21): editor + reproducción.** Sin kernel ni MCP.

| Archivo | Capa | Cambio |
|---|---|---|
| `js/story-clock.js` | Reproducción (fuera del kernel) | Funciones puras: `storyDependencies(scenario)` → `{valid: Map<stepId, sendId[]>, ignored: [{dep, reason}]}`; `momentSchedule(page, scenario, stepMeta)` → instantes visibles por momento (E2) y llegadas; `start(page, scenario, now)` = `FluyoStory.start` + copia del Trace con los instantes visibles; `momentTimes` con instantes visibles; índice del momento para el texto. |
| `js/editor-scenarios.js` | Editor | Declarar y quitar «Espera a que llegue…» desde el menú del paso, mostrado **a nivel de momento**. Se ofrecen solo los `SEND` de momentos anteriores, primero los que van al elemento del paso. Al borrar un Step se limpian sus pares; al duplicarlo se copian. Con Undo. La reproducción, la navegación y el seguimiento pasan a usar los instantes visibles. |
| `js/present-story.js`, `js/viewer.js` | Present y Viewer | Empezar con `FluyoStoryClock.start`; momento en curso por instante visible. |
| `sw.js` | Release | Subir `CACHE`. |
| `.ai/ARCHITECTURE.md`, `.ai/DECISIONS.md` | Documentación | El campo, E2 y las reglas de validez. |

- **No cambia en la fase 1:** motor, Trace, kernel (`model.js`, `scenario-playback.js`, `story-playback.js`, `document-integrity.js`, `story-authoring.js`), render, `version`, `engineVersion`, MCP ni el significado de `at`. El normalizador actual ya conserva el campo, así que no hace falta tocar `model.js` para guardarlo, abrirlo, compartirlo, deshacerlo o duplicarlo.
- **Compatibilidad:** sin el campo, `momentSchedule` devuelve `at`, idéntico a hoy. Los clientes antiguos ignoran el campo y lo conservan.

**Fase 2 (posterior): MCP.** Contrato de § 10. Exige una función pura de validación en el kernel (compartida por el editor y `FluyoAuthoring`), operaciones en `story-authoring.js`, y en fluyo-mcp `sync:kernel` + documentación de las herramientas.

**Tests de la fase 1** (vm con el Playback real; sin batería histórica):

| # | Comprueba | Tiempo |
|---|---|---|
| T1 | Toda dependencia válida se cumple: el momento se ve en o después de la llegada **medida** del token | < 1 s |
| T2 | Ningún momento anterior al primero que espera se mueve; sin dependencias, todos los instantes = `at` | < 0,5 s |
| T3 | Cadena CH → 0 / 1100 / 1600 / 2700; CHx → X en 250, Y en 1850; CHr igual que CH | < 0,1 s |
| T4 | Varios flujos: MF1 = MF2 = 1800; MF3 → 1000 / 1800 | < 0,1 s |
| T5 | Mismo momento: AT → los tres Steps en 1100 (atómico) | < 0,1 s |
| T6 | Historias antiguas (fixtures del repo + K7): instantes idénticos a hoy; Trace del motor idéntico; documento sin cambios | < 1 s |
| T7 | Dependencias inválidas (inexistente, a un Step eliminado, a un no-`SEND`, al mismo momento, hacia delante, ciclo) se ignoran y nunca bloquean | < 0,1 s |
| T8 | Formato: guardar/abrir, compartir (`#d=`), duplicar Historia, Undo/Redo y el kernel actual del MCP conservan el campo; un campo mal formado no rompe el documento | < 1 s |
| T9 | Editor (vm): declarar, quitar, borrar Step (limpia), duplicar Step (copia), mover a otro momento (la dependencia viaja) | < 1 s |
| T10 | Mutaciones: ignorar dependencias, calcular la llegada desde `at`, partir el momento, perder la pausa (E2→E1), usar `at` en `momentTimes`, no sustituir el Trace | < 15 s |
| — | Chrome: una pasada dirigida (CH y K8 en escritorio y móvil, leyendo `scenarioRuntime`) | ≤ 3 min |

## 14. Pruebas de diseño ejecutadas (scratchpad)

`format-probe.cjs` (< 1 s): Step frente a Historia frente a página, MCP, compartir, duplicar e ids estables.

`deps-proto.cjs` (1 s, 21 Historias × 4 modelos, Playback real a 1 ms):

| Caso | Fixture | Resultado |
|---|---|---|
| Cadena | CH, CHr | Dependencias cumplidas; orden estricto con E2 |
| Independientes | CHx, R3, PIPE | Nada anterior se mueve; PIPE intacto sin dependencias |
| Varias dependencias | MF2, K7d, K8 | Unión respetada |
| Mismo momento | AT, MF1 | Atómico |
| Documentos antiguos | 3 del repo + K7 | Idénticos a hoy |
| Dependencia inexistente / a Step eliminado / ciclo / a un no-`SEND` / al mismo momento | BAD | Ignoradas con su razón; el resto de la Historia se reproduce |

Totales:

| Modelo | Dependencias incumplidas | Orden roto | Momentos partidos | Momentos sin dependencia movidos | … antes de la 1.ª dependencia |
|---|---|---|---|---|---|
| Hoy | **19** | 0 | 0 | 0 | 0 |
| E1 | 0 | **5** | 0 | 0 | 0 |
| **E2** | **0** | **0** | **0** | 10 (solo detrás de una pausa declarada) | **0** |
| Modelo 4 | 0 | 0 | 0 | 29 | **19** |

El Trace del motor es idéntico en todos los casos.

## 15. Decisiones que necesito aprobar

- **D1 — Introducir primero una pequeña extensión del modelo de Historias**: un campo opcional en la Historia con pares (Step → `SEND`). Sin él no hay causalidad correcta sin inferir.
- **D2 — La dependencia apunta a un Step `SEND`** (su token), no a una conexión ni a un momento. La declara un Step y su efecto es **el momento entero** (unión). Se presenta siempre como «este momento espera a…».
- **D3 — E2 (pausa)** frente a E1. Recomendado: **E2**. Lo anterior nunca se mueve y lo posterior conserva el orden y el ritmo. E1 conserva todos los `at` no declarados, pero invierte el orden de la Historia.
- **D4 — Reglas de validez**: solo `SEND` de momentos anteriores; lo inválido se ignora, nunca bloquea ni invalida el documento; ciclos imposibles por construcción.
- **D5 — Historias antiguas**: sin cambios ni inferencias; conservan el problema hasta que se declaren dependencias. Sugerencias en el editor: fuera de este hito.
- **D6 — Fases**: fase 1 = editor + reproducción (sin kernel ni MCP); fase 2 = contrato MCP (§ 10, con kernel). Alternativa: MCP primero, lo que adelanta el cambio de kernel.
- **D7 — Nombre del campo** (`waits` / `arrivals` / `causes` / otro) y de la operación MCP.
- **D8 — Numeración**: la fase 1 sería 018.21; el panel de escritorio se desplaza.

## 16. Respuesta a la pregunta final

> ¿Tenemos suficiente estructura actualmente para implementar causalidad correctamente, o necesitamos introducir primero una pequeña extensión del modelo de Historias?

**Necesitamos una pequeña extensión.**

La **estructura** sí basta para alojarla sin tocar el motor, el Trace, el kernel ni el MCP:

- ids de Step estables y no reutilizables;
- `SEND` = token;
- un objeto Historia que todos los lectores actuales conservan.

Lo que **falta es información**: hoy nada dice qué momento espera a qué token. Inferirlo produce falsos positivos (v2, v3) y la barrera global introduce causalidad donde no existe (Modelo 4).

La extensión mínima es **un campo opcional en la Historia con pares (Step → `SEND`)**, interpretado solo por la reproducción (E2).

---

## Handoff

- **Qué se hizo**: v4 del diseño.
  - Se inspeccionó la identidad de los Steps y de los tokens.
  - Se demostró con el código actual dónde puede vivir un dato nuevo: en el Step rompe a todos los lectores; en la Historia, todos lo conservan.
  - Se diseñó la dependencia mínima (Step → `SEND`, efecto por momento) y se calcularon cadena, independientes, momento atómico, varios flujos, Kafka, Historias antiguas, inválidas y ciclos.
  - Se compararon los modelos A–E y se recomienda E2.
- **Archivos modificados**: solo `.ai/tasks/FLUYO-018.20.md`. Sin cambios de código, kernel, `model.js`, MCP, render, Viewer, Present, formato ni `CACHE` (v78).
- **Pruebas**: `format-probe.cjs` y `deps-proto.cjs` en el scratchpad (≈ 2 s en total). Sin Chrome y sin baterías históricas.
- **Pendiente**: aprobación de D1–D8.
- **Próximo paso concreto**: con D1–D4 y D6 aprobadas, abrir 018.21 (fase 1, § 13) con los tests T1–T10.

FLUYO-018.20 — READY FOR REVIEW
