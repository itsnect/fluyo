# SCENARIO-SEMANTICS-001 — Registro de decisiones

Estado: **ACEPTADO** por el PO el 2026-10-18 (todas las decisiones D1–D12 y sus anexos). Lo implementado se resume en
`.ai/DECISIONS.md` (214 en adelante); lo pendiente se implementa por fases (tarea, § 9). Las cuatro preguntas que quedaban
abiertas las cerró el PO al revisar FASE 1 (NO_PATH, Condiciones, W5, documentación del prototipo): ver § PO al final, ACEPTADO.

Tarea: `.ai/tasks/FLUYO-SCENARIOS-SEMANTICS-001.md` (FASE 0: auditoría, diseño, contrato, plan de integración y de pruebas).
Evidencia de UX: rama `prototype/scenario-semantic-playback` (`9d36648`, `f151dfe`), QA manual del PO: PASS.

> **Líneas de implementación.** `feat/scenario-semantics` es la línea **histórica**: `4fb5872` (FASE 1), `e47500f` (cierre de
> FASE 1 y contrato congelado de FASE 2) y `94e50fa` (FASE 2), construidos sobre `d31703e`. Su lógica es la referencia de
> comportamiento y de pruebas; el problema fue la base, no la lógica: `main` avanzó (`ce8e699`, FLUYO-019-HIT-TEST) con la misma
> `CACHE` v90 y las decisiones 209–211. `feat/scenario-semantics-rebased` reaplica FASE 1 y FASE 2 en commits nuevos sobre
> `ce8e699`: son los **candidatos de producto**. En la línea reconstruida las decisiones eran 213–224 (antigua N → N + 4); al reintegrarse sobre `main` `0409f4d` son 214–225 (N + 1: FLUYO-019.4a tomó la 213).

> Ubicación: `AGENTS.md` fija `.ai/` como sitio de la documentación técnica (arquitectura, decisiones, tareas). `docs/` es la
> página pública de ayuda, precacheada por `sw.js` (`./docs/`): escribir ahí sería tocar un archivo servido y obligaría a
> subir `CACHE`, prohibido en FASE 0. Por eso este registro vive en `.ai/architecture/`.

---

## 0. Qué se productiza y qué no

**Núcleo**: tres semánticas de conexión (Conexión, Flujo, Requisito), tres valores de disponibilidad (AVAILABLE,
UNAVAILABLE, UNKNOWN; ver D3 para cuándo entra UNKNOWN) y la **ruta observada** de una Historia, derivada en cada instante.
El valor que se entrega: distinguir **«cambió el estado de un nodo»** de **«cambió el comportamiento de la ruta»**.

**Contrato de producto**: *Semantic Scenarios ayuda a comunicar cómo los cambios de estado modelados afectan a las rutas
estructurales modeladas.*

No promete ni sugiere: salud real en ejecución, éxito de peticiones, capacidad, latencia, SLA, causa raíz, reintentos ni
profundidad de colas. Fluyo no se convierte en sistema de monitorización, simulador de ejecución, simulador de sistemas
distribuidos, panel de salud ni herramienta de incidentes. Ninguna superficie usa «sano», «degradado», «afectado»,
«bloqueado», «impacto» ni «causa».

**Cuatro niveles que nunca se mezclan**

| Nivel | Ejemplo | Dónde vive |
|---|---|---|
| Estado | `C = UNAVAILABLE` | Behaviors + Trace (motor), como hoy |
| Transición | `C: AVAILABLE → UNAVAILABLE` | `state_changed` del Trace |
| Relación temporal | «la ruta pasó a no disponible en el mismo momento en que C cambió» | derivada (timeline) |
| Afirmación causal | «D falló porque C falló» | **fuera de alcance**; nunca se deriva del orden ni de la topología |

**Sin inferencia**: ninguna IA, LLM ni heurística clasifica conexiones ni sugiere «esto debería ser Flujo». La autoría es
explícita. El error silencioso por anotación incorrecta es conocido y se acepta; solo se ofrece validación estructural (§ V).

---

## D1 — Almacenamiento de `edge.kind` · ACEPTADO

- `kind` es una **propiedad opcional de la conexión** en `.fluyo.json` v5. Sin versión nueva de formato.
- Valores que la autoría escribe (lista cerrada): `"FLOWS_TO"` (Flujo) y `"REQUIRES"` (Requisito).
- **Lectura** (`edgeKind(e)`, pura): `"FLOWS_TO"` → Flujo; `"REQUIRES"` → Requisito; cualquier otra cosa → Conexión.
- **Normalización** (`normalizeProjectEdge`, `model.js`, kernel):
  - `kind` ausente → se queda ausente (nunca se rellena);
  - `kind: null` → se quita la clave (como `arrowSize`, decisión 197);
  - `kind` string → **se conserva tal cual** aunque no sea de la lista (compatibilidad hacia delante: un valor futuro no
    lo borra un editor de hoy); se interpreta como Conexión y la validación estructural lo avisa (W3);
  - `kind` de otro tipo (número, objeto…) → se quita la clave.
  - Diferencia deliberada con `settings.skin` (decisión 201, que quita valores desconocidos): `kind` es dato semántico del
    autor; perder un valor futuro al re-guardar destruiría significado.
- **Autoría**: `kind` entra en `CONNECTION_SPEC_KEYS` y `CONNECTION_UPDATE_KEYS` (`model.js`); `updateConnectionIn` acepta
  `"FLOWS_TO" | "REQUIRES" | null` (null = Conexión, quita la clave) y rechaza otro valor (`invalid_document`, campo `kind`).
  El editor escribe SIEMPRE por `editEdge(e,{kind})`, nunca `e.kind = …` inline (regla de 018.3; el prototipo la saltaba).
- Copiar/pegar, duplicar (`cloneStructureIn`), Undo (snapshot de página), autoguardado, archivo, `#d=`, Share y «Añadir
  como página» ya copian la conexión entera: `kind` viaja sin código nuevo (verificado en la auditoría).

## D2 — Conexión por defecto · ACEPTADO

- **Ausencia de `kind` = Conexión** (genérica). Es el estado de todos los documentos existentes.
- **No se persiste `"GENERIC"`** (preferencia del PO confirmada; no hay evidencia técnica en contra: el corpus no tiene
  ninguna conexión con `kind` y el kernel conserva la ausencia). Un documento que traiga `"GENERIC"` lo conserva y lo lee
  como Conexión (D1).
- **Ningún documento antiguo se transforma** en Flujo, ni por migración, ni por heurística, ni al abrir, ni al guardar.
- Una conexión nueva nace Conexión (sin clave), también tras haber marcado otra como Flujo: no se hereda el último tipo.
- Cambiar el tipo es **una entrada de Undo** (`pushUndo` + `editEdge`); elegir el valor actual no escribe ni apila.

## D3 — Estrategia de UNKNOWN · ACEPTADO: **DEFER_AUTHORING (Alternativa B)**

**Hallazgos que la motivan** (auditados en código, no supuestos):

1. **Kernel**: `SCENARIO_STATES`, `EVENT_TYPE_AVAILABILITY` (`model.js:62,65`) y `VALID_STATES` (`scenario-engine.js:14`)
   solo admiten `UP|DOWN`. Un documento con UNKNOWN en un Step, un Behavior o un EventType **no carga**
   (`projectDataError`): el editor actual dice «no es un diagrama Fluyo válido», el Viewer «invalid_document».
2. **Motor**: el prototipo hizo UNKNOWN aditivo pero un `SEND` solo falla con `DOWN` (`scenario-engine.js:188-189`): un
   envío desde/hacia un nodo UNKNOWN **se completa**. Es exactamente «interpretar UNKNOWN como disponible» en el Trace,
   que es kernel y golden compartido con el MCP. Productizar UNKNOWN exige decidir antes la semántica de SEND con UNKNOWN.
3. **Pintado**: `drawScenarioNodeOverlay` (`render.js`) solo oscurece `DOWN`: fuera del modo prototipo, en Present y en el
   Viewer un nodo UNKNOWN se pinta disponible. Viola el gate.
4. **Textos**: `story-playback.js:222` diría «X vuelve a estar disponible» ante un UNKNOWN; el storyboard dice «cambia de
   estado»; «Condiciones» solo ofrece Disponible/No disponible; la vista previa del diálogo solo conoce `DOWN`.
5. **MCP** (auditoría de `fluyo-mcp`, HEAD `81154f1`): con el kernel actual, `describe_document` da `readable:false`,
   `run_story` `document_unreadable` y `author_document`/`set_theme`/`reorder_nodes`/`duplicate_node`/`propose_layout`
   `DOCUMENT_UNREADABLE`. Además `z.enum(["UP","DOWN"])` en `authoring.ts:79,267`, `initialUnavailable` solo filtra
   `DOWN` (`stories.ts:252`), defaults `"UP"` en `stories.ts:237,478` y ningún test de deriva vigila la disponibilidad.
6. **Editores anteriores**: fallo duro, no degradación. Con el service worker cache-first, la primera carga tras un
   despliegue ejecuta el código anterior: un enlace con UNKNOWN abriría en error hasta recargar. Un pegado entre pestañas
   de versiones distintas (`fluyo::` + `cloneStructureIn`, que no valida Behaviors) podría inyectar un Behavior UNKNOWN en
   un editor anterior y dejar su autoguardado ilegible.

**Comparación**

| Criterio | A — UNKNOWN ya | B — Flujo primero, UNKNOWN sin autoría |
|---|---|---|
| Complejidad | kernel + motor (SEND) + render en 3 superficies + textos + diálogo + Condiciones + MCP (kernel, zod, describe, run) + versión de formato | derivación tri-estado lista, sin dato persistido nuevo |
| Coherencia | alta solo si TODAS las superficies llegan a la vez; si no, UNKNOWN = disponible en alguna | total: el único dato nuevo (`kind`, `observedFlow`) degrada limpio |
| UX | la más rica (QA PASS) | pierde «estado desconocido» en la primera entrega |
| Riesgo | fallo duro en editores/MCP anteriores, Trace que cambia | bajo: valores persistidos siguen siendo UP/DOWN |
| Deuda | semántica de SEND con UNKNOWN decidida con prisa | una tarea propia, con su decisión de motor y de formato |
| Producto | entrega más tarde todo el núcleo | entrega antes lo validado más fuerte: «cambió un nodo» vs «cambió la ruta», ruta alternativa, Requisito que no propaga |

**Recomendación: B.** La derivación de ruta se escribe tri-estado (UNKNOWN como valor interno y para lo que no sea `UP`/`DOWN`),
con pruebas, pero ninguna superficie permite **persistir** UNKNOWN hasta una tarea propia que resuelva, en este orden:
(1) semántica de `SEND` con extremo UNKNOWN (opciones: completar como hoy, terminal nuevo, fallar; es decisión de motor y
cambia goldens), (2) versión de formato: escribir `version: 6` **solo** cuando el documento contiene UNKNOWN, para que un
editor/Viewer anterior diga «Este diagrama necesita una versión más reciente de Fluyo» (`unsupported_version`, ya existe) en
vez de «documento inválido»; los documentos sin UNKNOWN siguen en v5, (3) pintado en `render.js` único para editor, Present
y Viewer, (4) textos y Condiciones, (5) MCP (kernel, zod, describe, run_story, test de deriva de disponibilidad).

**Gate permanente**: *UNKNOWN nunca se interpreta ni se pinta como AVAILABLE en ninguna superficie compatible.* En B se
cumple porque toda entrada rechaza UNKNOWN (editor, archivo, enlace, Viewer, MCP) y la derivación trata cualquier valor que
no sea `UP` como no disponible para «Ruta disponible» (`availabilityOf`: `UP`→AVAILABLE, `DOWN`→UNAVAILABLE, resto→UNKNOWN).

## D4 — Procedencia (DEFAULT / EXPLICIT) · ACEPTADO

- **Metadata derivada de presentación**, no estado de dominio: no se persiste, no es un cuarto valor de disponibilidad y
  **no altera** el estado de la ruta (mismo resultado con y sin procedencia; test obligatorio).
- **Definición (congelable)**: el estado de un nodo en `t` es EXPLICIT si
  (a) existe un Behavior de la página para ese nodo (cualquier `initialState`), o
  (b) existe un `SET_STATE` de la Historia sobre ese nodo con **instante visible** ≤ `t` (`FluyoStoryClock`, el mismo
  reloj que proyecta el estado), aunque no cambie el estado (`API ya estaba disponible` + `SET_STATE UP` = EXPLICIT).
  Si no, su `UP` es DEFAULT. `DOWN` (y UNKNOWN) nunca son DEFAULT.
- Ruta disponible EXPLICIT = alguna ruta disponible tiene todos sus nodos EXPLICIT; si todas las disponibles tienen algún
  nodo DEFAULT → DEFAULT → se añade «incluye estados por defecto». Solo matiza un resultado **disponible**.
- **Auditoría de la definición** — se puede congelar con dos aclaraciones y un punto para el PO:
  1. *Tiempo*: el prototipo, sin reproducir, usaba instantes narrativos (`FluyoStory.run`) y, reproduciendo, visibles. Con
     dependencias de llegada (018.21) difieren. Producto: **siempre instantes visibles** (`FluyoStoryClock.schedule` /
     `visibleTrace`), en edición y en reproducción.
  2. *Límite*: `≤ t` inclusivo, igual que `statesAt` y que el Playback (`ev.at > cursor` corta).
  3. **Cerrado por el PO (§ PO): Condiciones cuenta como EXPLICIT.** Hallazgo original: «Condiciones → Disponible» **no guarda Behavior**
     (`setInitialAvailability` quita la entrada; «UP es el valor por defecto y se representa sin Behavior», `model.js:653`).
     Quien elige explícitamente «Disponible» en Condiciones obtiene DEFAULT; la única forma de afirmar `UP` al inicio es un
     `SET_STATE` en el primer momento (lo que hace el fixture «estados afirmados»). Opciones: (i) aceptarlo y documentarlo
     (recomendado para el MVP: sin cambio de dominio ni de MCP); (ii) que Condiciones persista `{initialState:"UP"}`
     (compatible con el formato y el motor, pero cambia el contrato de `setInitialAvailability` y de
     `set_initial_availability` del MCP). No es una contradicción técnica grave; no reabre la dirección aprobada.

## D5 — Persistencia del flujo observado · ACEPTADO: **STORY_PERSISTED (O2)**

- Dato opcional de la **Historia**: `scenario.observedFlow = {from, to}` (ids de nodo de la misma página; mismo
  vocabulario que `edge.from/to`; el MCP puede exponerlo como `source/target`, como hace con las conexiones).
- Precedente: `scenario.arrivalDependencies` (018.21) es un dato opcional de Historia que el motor no ve, que
  `normalizeScenarios` conserva y que editores anteriores, duplicar Historia, Undo y «Compartir historia» ya preservan. Los
  Steps no admiten claves extra; la Historia sí (verificado).
- **O1 vs O2**

  | | O1 efímero | O2 en la Historia |
  |---|---|---|
  | Formato | nada | clave opcional, passthrough en editores/MCP anteriores |
  | Intención del autor | se pierde al recargar, al compartir y en Present | viaja con la Historia |
  | Viewer / Present | solo si el par se deduce estructuralmente único; con dos flujos posibles no hay nada que mostrar | lo que el autor eligió |
  | Determinismo | depende de la sesión | depende solo del documento |
  | Undo | fuera de la pila | una entrada (como renombrar la Historia) |
  | Coste | 0 | normalización + cascada al borrar nodo + recuperación |

  O2 gana porque Viewer y Present (D7, D8) no tienen selectores: sin dato persistido, una Historia con varios flujos no
  podría contar su ruta fuera del editor. O3 (colección de flujos vigilados) no se propone: introduce estructura y lleva a
  vigilar todos los pares.

- **Resolución determinista** (`resolveObservedFlow(page, scenario)`, pura, igual en todas las superficies):
  1. `observedFlow` presente y sus dos nodos existen y son distintos → ese par (origen «historia»).
  2. presente pero algún extremo no existe → estado derivado **ENDPOINT_MISSING**; **no** se cae al par estructural (no se
     observa en silencio otra cosa). Editor: recuperación (selector marca el extremo perdido); Viewer/Present: nada de ruta.
  3. ausente → par estructural si en el subgrafo de Flujo hay **exactamente un** nodo sin entradas y **exactamente uno** sin
     salidas (orden del documento) (origen «estructural»).
  4. si no → ninguno: el editor pide elegir origen y destino; Viewer/Present no muestran ruta.
- **Selectores** (solo editor): nodos que participan en alguna conexión Flujo, en orden del documento, más los extremos
  guardados aunque ya no participen. Origen = destino imposible (el otro selector lo excluye). Elegir escribe ambos extremos
  (una entrada de Undo, autoguardado); «Automática» quita la clave (Undo). Cambiar de Historia no escribe.
- **Cascadas**: `deleteNodeIn` (`model.js`) quita el `observedFlow` de las Historias de su página que lo nombran, en la
  misma entrada de Undo (como el Behavior); `removalImpact` lo informa. Un editor anterior no poda: queda ENDPOINT_MISSING y
  la recuperación lo resuelve. Cambiar el tipo de una conexión, mover o retargetear no toca `observedFlow`.
- **Topología cambiada**: la ruta se deriva en cada fotograma; si ya no hay camino → NO_PATH (D-Ruta). Nada se reescribe.
- **Varios caminos**: el estado se calcula por alcanzabilidad (exacto, sin tope). La enumeración de caminos solo alimenta la
  evidencia (≤ 3 filas + «+N»), nunca el estado. **Sin vigilancia de todos los pares.**

## D-Ruta — «Ruta disponible»: contrato semántico formal · ACEPTADO (anexo de D5/D6)

Sea G el subgrafo dirigido de las conexiones con `edgeKind = FLOWS_TO` cuyos dos extremos existen (dirección
`from → to`; las puntas visibles, `startArrow`/`endArrow` y `flowDir` **no** cambian la semántica). Conexión y Requisito no
entran. Origen `a`, destino `b`; `a = b` es el camino trivial de longitud 0 que contiene solo ese nodo (FASE 2: nunca
NO_PATH; su estado es el del nodo). `s(n)` = disponibilidad visible del nodo en `t` (Behaviors + Trace visible).

| Estado | Definición | Texto aprobado |
|---|---|---|
| AVAILABLE | `b` alcanzable desde `a` en G restringido a nodos con `s = AVAILABLE` (incluidos `a` y `b`) | «Ruta disponible» (+ «incluye estados por defecto» si D4 = DEFAULT) |
| UNKNOWN | no AVAILABLE y `b` alcanzable en G restringido a `s ∈ {AVAILABLE, UNKNOWN}` | «Estado de la ruta desconocido» (inalcanzable en el MVP, D3) |
| UNAVAILABLE | `b` alcanzable en G, pero todo camino contiene ≥ 1 nodo UNAVAILABLE | «Ruta no disponible» |
| NO_PATH | `b` no alcanzable desde `a` en G (solo estructura) | «Sin ruta de flujo» (PO). No es UNAVAILABLE: nunca usa la semántica visual de fallo ni de disponibilidad |

- Equivale a la definición por caminos simples del prototipo (alcanzable ⇔ existe camino simple), pero es O(V+E), exacta y
  sin el tope `MAX_PATHS = 64` del prototipo, que con la ruta disponible fuera de los 64 primeros caminos daba un estado
  **falso**. NO_PATH se distingue de UNAVAILABLE (el prototipo los confundía: sin caminos devolvía UNAVAILABLE).
- NO_PATH en producto: la herramienta muestra el par y el texto del PO, sin línea de tiempo ni filas; el lienzo no pinta
  fundas. ENDPOINT_MISSING y «sin par» son estados de la herramienta, no de la ruta.
- Ciclos: no afectan (alcanzabilidad; la enumeración de evidencia usa caminos simples).

## D6 — Derivación de la línea de tiempo · ACEPTADO: **entra al MVP, solo derivada**

- Nunca se persisten `behaviorTimeline`, `episodes`, `flowHistory` ni procedencia. Se reconstruye de **estructura +
  Behaviors + Steps de la Historia** con la receta única (`FluyoStory.run`) y el horario visible (`FluyoStoryClock`),
  memoizada por firma del documento (no un `JSON.stringify` por fotograma como el prototipo).
- **Dónde**: en la herramienta de ruta, dentro del panel de Historias, justo bajo el transporte (ubicación validada).
  Orden de la experiencia: controles de Historia → ruta observada (origen → destino) → estado actual (+ procedencia) →
  línea de tiempo → evidencia de rutas. No hay panel derecho nuevo; el lienzo sigue siendo protagonista.
- **Cuándo aparece**: la página tiene al menos una conexión Flujo **y** la Historia activa tiene Steps. Si no, la
  herramienta no existe (la Historia se ve como hoy).
- **Edición**: estado «Al inicio · …», timeline completa sin cursor. **Reproducción**: cursor (pausa, saltos ⏮/⏭ y
  Detener lo mueven como al Playback; la timeline no es un control de salto en el MVP: no añade semántica al reloj).
- **Casos**: sin par → selectores + aviso, sin timeline; NO_PATH → sin timeline; un solo estado → un tramo y «Cambios de la
  ruta: ninguno»; UNKNOWN → tramo rayado (preparado, no alcanzable en MVP); **frontera** = instante (visible) en que cambia
  el estado de la ruta → barra; **cambio de un nodo de alguna ruta sin frontera** → punto; cambios de nodos fuera de las
  rutas → nada. Eventos del mismo instante se aplican juntos (una sola marca).
- Fin de la timeline = fin visible de la Historia (último momento + duración visible), no «último cambio + 1,5 s».

## D7 — Viewer · ACEPTADO: **V2**

- El Viewer pinta lo que diga el documento, **sin bandera** (como la piel, decisión 204):
  - marcas estáticas de Flujo y Requisito en el lienzo (siempre, reproduciendo o no);
  - reproduciendo la Historia y si `resolveObservedFlow` da un par: fundas/barrido de la ruta en el lienzo, marca de estado
    de nodo y **una línea** de estado de la ruta (con «incluye estados por defecto») en la banda de la Historia.
- Sin selectores, sin filas de evidencia, sin línea de tiempo, sin panel de edición (V3 descartado).
- Carga el módulo puro de ruta (no kernel) entre `story-clock.js` y `viewer.js`; un Viewer con el service worker anterior
  abre el documento como hoy (las marcas se pintan con guardas `typeof`, como la piel).

## D8 — Present · ACEPTADO

- **Sí**: marcas estáticas, fundas/barrido de la ruta y estado de nodo en el lienzo; una línea de estado de la ruta en el
  mando de la Historia (`#psGroup`) solo si hay par resuelto.
- **No**: selectores origen/destino, evidencia, línea de tiempo. Present es narrativa visual y read-only (FLUYO-013).
- Se pinta con el mismo `renderState` que el editor (una receta), respetando la piel «construido» (las fundas siguen el
  trazo con el aterrizaje de `skinEdgeLanding`) y «reducir movimiento» (sin barrido).

## D9 — Paridad MCP · ACEPTADO

Auditoría (HEAD `81154f1`, kernel sincronizado con `1ee65ee`, `check:kernel` OK):

| | Hoy | Riesgo para el release |
|---|---|---|
| M1 ¿entiende `kind`? | No. `ConnectionSpec` es `z.strictObject` → `kind` rechazado; `EdgeSpec` de `create_diagram`/`create_from_template` es `z.object` → **lo quita en silencio** | MEDIUM |
| M2 ¿conserva lo desconocido? | Sí: `DocumentInputSchema` es `looseObject` (`pages: unknown[]`), normaliza el kernel y devuelve su copia; ninguna salida reconstruye conexiones campo a campo | LOW |
| M3 ¿entiende UNKNOWN? | No: todo el documento se vuelve ilegible (`DOCUMENT_UNREADABLE`, `readable:false`); enums `UP|DOWN` en zod | BLOCKER si UNKNOWN entrara (no en el MVP, D3) |
| M4 ¿produce documentos que el editor interpreta bien? | Sí (misma normalización del kernel) | LOW |
| M5 ¿puede destruir semántica? | `author_document`, tools de una operación, `propose_layout`, `duplicate_node` conservan `kind` y `observedFlow`; solo `create_diagram`/plantillas lo pierden en la entrada; `describe_document` no lo ve | LOW–MEDIUM |

**Cambios antes del release** (fluyo-mcp, repo aparte, en las fases indicadas):
- FASE 1: `sync:kernel` (nuevo `KERNEL_ID`) en el mismo cambio que `model.js` (decisión 70).
- FASE 5: `kind` en `ConnectionSpec`/`ConnectionPatch`/`EdgeSpec` (`"FLOWS_TO"|"REQUIRES"|null`); `describe_document`
  expone la semántica de la conexión con un nombre que **no** choque con `target.kind` (p. ej. `connectionKind`) y el
  `observedFlow` de cada Historia; operación `set_observed_flow` (o equivalente) en `author_document`; `export_diagram` con
  las marcas estáticas (D-Export) por port literal y golden compartido; test de deriva de disponibilidad (hoy no existe).
- Sin derivación de ruta en el MCP en el MVP (sería otra tool; no se propone).

## D10 — Bandera y rollout · ACEPTADO

- **Bandera interna «labs»** por navegador: `localStorage["fluyo.labs.escenarios"]`, que se activa con `?labs=escenarios` y
  se apaga con `?labs=off` (patrón de preferencias de interfaz, decisión 134: no entra en el documento). Sin interruptor
  visible hasta FASE 6. `?prototipo=escenario-semantico` **no** es contrato de producto y desaparece.
- **Regla**: *lo que el documento dice se pinta sin bandera; las herramientas de autoría y de comportamiento van tras la
  bandera.*
  - Sin bandera (siempre): normalización y validación de `kind`/`observedFlow` (kernel), passthrough, marcas estáticas de
    Flujo/Requisito, Viewer (que nunca depende de la bandera).
  - Con bandera (hasta FASE 6): selector Conexión/Flujo/Requisito, herramienta de ruta, overlays de comportamiento en el
    editor y Present.
- Fases: ver la tarea (FASE 1–6), cada una con alcance, pruebas, frontera de rollback y aceptación. La retirada de la bandera
  es decisión del PO tras FASE 6.

## D11 — Estrategia de integración · ACEPTADO: **B (reimplementar limpio sobre `main`)**

- A (cherry-pick y limpiar): los dos commits suben `sw.js` a v88/v89, **las mismas versiones** que ya usa `main` (019.5 =
  v88) y el trabajo sin commit de FLUYO-019-FLOW-FADE (v89) → colisión de caché garantizada; tocan ~48 tests solo por la
  constante; meten código con bandera por URL, `typeof` globales, fixture y estilos inyectados, UNKNOWN en el kernel y 20
  PNG en un repo público. Limpiarlo cuesta más que reescribirlo.
- C (hunks selectivos): no hay hunks aislables de valor: todo el código útil está en dos archivos nuevos acoplados a la
  bandera, y los ganchos de una línea cambian de forma en producto (renderState, `editEdge`).
- **B**: el prototipo es evidencia de UX y fuente de casos de prueba (T1–T12, U1–U10). Nada se copia sin reescribir; la
  rama del prototipo no se mergea ni se rebasa.

## D12 — Bloqueantes de release · ACEPTADO

| Id | Bloqueante | Clase | Estado en el diseño |
|---|---|---|---|
| B1 | UNKNOWN pintado como UP en alguna superficie | BLOCKER (gate permanente) | MVP: se cumple por rechazo en todas las entradas (D3); test por superficie |
| B2 | MCP pierde UNKNOWN | NOT_APPLICABLE en el MVP (UNKNOWN no se persiste); BLOCKER para la tarea de UNKNOWN (hoy no lo pierde: rechaza el documento entero) | — |
| B3 | MCP pierde `edge.kind` | MEDIUM | `create_diagram`/plantillas lo quitan en la entrada; se corrige en FASE 5 |
| B4 | documentos antiguos cambian de semántica | BLOCKER (gate) | por diseño (D1, D2); test byte a byte del corpus |
| B5 | `observedFlow` apunta a un nodo borrado sin recuperación | HIGH | cascada en `deleteNodeIn` + ENDPOINT_MISSING + recuperación en el editor |
| B6 | derivación persistida como segunda verdad | BLOCKER (gate) | prohibido por D4/D6; test de que el documento serializado no contiene claves derivadas |
| B7 | código de bandera del prototipo filtrado a producción | BLOCKER (gate) | por D11; test estático (sin `PROTO_`, `prototipo=`, `protoSemantic`) |
| B8 | desajuste de caché del service worker | HIGH | colisión real v88/v89 (ver D11); cada fase sube a la siguiente versión libre de `main` en su momento |
| B9 | contradicción temporal de la Historia que confunde | HIGH (pasa a BLOCKER si el QA de FASE 6 la juzga engañosa) | ver § T |

## § T — Sincronización temporal · ACEPTADO

- **T1**: la disponibilidad de la ruta cambia en el **instante de aplicación** del estado: el `at` visible del
  `state_changed` (con dependencias de llegada aplicadas). Fundido de rama y barrido empiezan en ese instante, nunca antes.
- **T2**: la animación de un `SEND` **no** modifica estado ni ruta; los tokens nunca alimentan la derivación.
- **T3 — sí, la UI puede mostrar una contradicción** (preexistente, no la crea esta feature):
  - **C1**: el motor decide el éxito de un `SEND` en su `at` (`scenario-engine.js:187-190`); el token viaja 500/1100/1800 ms
    después (`MOTION_MS`). Si un `SET_STATE` deja el destino (o un nodo de la ruta) UNAVAILABLE dentro de esa ventana, el
    lienzo pinta la funda terracota y el barrido sobre la conexión mientras el token llega con su efecto de llegada
    «completada». **Bloqueante exacto (B9)**: en una Historia con ruta observada, un `send_succeeded` cuya ventana visible
    `(at, at + MOTION_MS]` contiene un `state_changed` que pasa la ruta a UNAVAILABLE sobre una conexión de esa ruta.
  - Mitigación sin cambiar semántica (decisión 200 descarta avisos heurísticos de causalidad): el patrón de autoría ya
    existe (`waitsForArrivalOf`, «Esperar a que llegue…»); FASE 6 incluye un fixture mixto SEND + SET_STATE para que el PO
    juzgue la legibilidad. No se diseña otro reloj.
  - **C2** (solo con UNKNOWN): `SEND` hacia/desde UNKNOWN se completa (D3, hallazgo 2).

## § Requisito — regla de pintado · ACEPTADO

- El estilo de una conexión Requisito es **estable durante la reproducción**: no cambia de color, ni de grosor, ni se anima
  con el estado de nadie. El estado del nodo requerido se ve **solo en ese nodo**. **Sin propagación visual.**
- No existen `RequirementStatus`, «satisfecho», «insatisfecho» ni «afectado». Requisito no participa en la ruta.
- **REDESIGN de la marca**: el prototipo usaba trazo discontinuo + anillo en el origen; `dashed` ya es un estilo de usuario
  (`e.dashed`, usado por ejemplos), así que una Conexión discontinua parecería un Requisito. La marca distintiva debe ser la
  que no existe hoy (el anillo en el extremo que requiere), y el discontinuo propio del usuario se respeta.

## § Pintado — clasificación del tratamiento visual (contrato, sin diseño nuevo)

| Tratamiento | Clasificación | Nota |
|---|---|---|
| AVAILABLE: halo oliva | TUNE | sin «respiración» (la oscilación sugiere monitorización); estático |
| UNAVAILABLE: funda terracota apagada discontinua | KEEP | verificar contraste en crema/claro/oscuro y con la piel |
| UNKNOWN: funda gris discontinua | KEEP en el sistema visual, fuera del MVP (D3) | |
| Ruta cambia: barrido único | KEEP | ninguno con «reducir movimiento» |
| Nodo cambia sin cambiar la ruta: solo transición local | KEEP | integrada en el pintor de overlays de nodo existente (un pintor, no un gancho) |
| Marca de estado del nodo (pastilla) | TUNE | convivir con el oscurecido `DOWN` y los cues de evento sin apilar señales |
| Flujo: cuñas de dirección | TUNE | no competir con puntas y puntos de flujo |
| Requisito: discontinuo + anillo | REDESIGN | ver § Requisito |

## § Export · ACEPTADO

- Las **marcas estáticas** (Flujo, Requisito) son significado del diagrama: se exportan en SVG/PNG/JPG/GIF y en
  `export_diagram` (port literal, golden compartido). Sin `kind`, la exportación es byte a byte la de hoy.
- Los **overlays de comportamiento** (halo, fundas, barrido, pastillas, timeline) nunca se exportan (`isExport`).

## § V — Validación estructural (solo avisos, nunca inferencia) · ACEPTADO

| Id | Aviso | Dónde |
|---|---|---|
| W1 | la ruta observada no tiene camino de Flujo (NO_PATH) | herramienta de ruta |
| W2 | un extremo de `observedFlow` ya no existe (ENDPOINT_MISSING) | herramienta de ruta; `FluyoIntegrity` como aviso, no error |
| W3 | `edge.kind` desconocido (se conserva, se lee como Conexión) | `FluyoIntegrity` aviso; `describe_document` |
| W4 | literal de disponibilidad inválido | ya es error del kernel (sin cambio) |
| W5 (ACEPTADO; implementado en FASE 1) | conexión Flujo cuya punta visible apunta al revés (`startArrow` sin `endArrow`) | aviso no bloqueante en Propiedades (`#kindNote`, tras la bandera): «La punta visible apunta en sentido contrario al flujo.» Ayuda: «El flujo se calcula de origen a destino; la punta solo cambia la apariencia.» Nunca invierte origen/destino; ni puntas ni `flowDir` cambian la semántica |

Prohibido: «esta conexión probablemente debería ser Flujo» o cualquier sugerencia de tipo.

## § Autoría de la conexión · ACEPTADO

- Selector segmentado **Conexión · Flujo · Requisito** en Propiedades (KEEP), primera fila del grupo «Trazo» como en el
  prototipo, con `segBind`/`segSync` (radiogroup accesible: flechas, Inicio/Fin, Espacio; 018.23). Markup estático en
  `index.html` (no inyectado).
- La conexión recién creada queda seleccionada (comportamiento actual): el selector aparece en el mismo gesto, valor Conexión.
- Revisar en FASE 1: columna estrecha (216 px tableta: tres etiquetas pueden no caber → apilado `@container` < 240 px ya
  existente), hoja móvil (≤ 700 px, grupos plegados por defecto → «Trazo» debe quedar a la vista para una conexión) y
  apaisado. Sin rediseño salvo problema medido.

## § Undo / Redo · ACEPTADO

| Cambio | ¿Undo? | Cómo |
|---|---|---|
| Conexión → Flujo, Flujo → Requisito, Requisito → Conexión | sí, una entrada | `pushUndo` + `editEdge` (snapshot de página) |
| Crear/editar evento UNKNOWN | no aplica en el MVP (D3); cuando entre, como cualquier EventType (`libSnap`, 018.7d) | — |
| Elegir/quitar `observedFlow` | sí, una entrada (D5: es dato de la Historia) | `pushUndo` (el snapshot de página ya incluye Historias) |
| Borrar nodo extremo del flujo observado | sí, la misma entrada que el borrado | cascada en `deleteNodeIn` |
| Cambiar de Historia activa | no (como hoy, 016) | — |

## § PO — Decisiones cerradas al revisar FASE 1 · ACEPTADO

FASE 1: APPROVE WITH CHANGES (sin rediseño; los cambios son estas decisiones y la verificación en Chrome real).
FASE 2: aprobada conceptualmente.

**Segunda revisión del PO (después de `94e50fa`)**: FASE 1 APPROVE WITH CHANGES, bloqueada por C1–C3; FASE 2 (`94e50fa`)
candidata, bloqueada por la base de FASE 1; FASE 3 sin empezar.

- **C1 — base divergente**: `main` `ce8e699` ya usa `CACHE` v90 (la misma que `4fb5872`: un cliente con la v90 de `main` no
  actualizaría nunca a FASE 1) y las decisiones 209–211; el merge da conflictos en 5 archivos. Se reaplica sobre `main` con la
  siguiente `CACHE` libre (v92; la v91 la reserva FLUYO-019-HIT-TEST-D6, en curso), decisiones renumeradas, línea base nueva y
  QA en Chrome repetido, con el upgrade desde la v90 de `main`.
- **C2 — kernel del MCP**: `63d97b8` sincroniza el kernel con `4fb5872`; hay que resincronizarlo desde el commit nuevo de
  FASE 1 (`check:kernel` y la suite completa del MCP).
- **C3 — W5 en FASE 1**: las cuñas de Flujo ya se pintan de origen a destino y pueden contradecir la punta visible; el aviso
  aprobado (decisión 221) entra con la autoría de FASE 1, no después.

1. **NO_PATH**. Texto de producto: «Sin ruta de flujo». Significa: no existe estructuralmente ningún camino `FLOWS_TO`
   entre origen y destino. Depende solo de la estructura. **No es UNAVAILABLE** y nunca usa la semántica visual de fallo ni
   de disponibilidad.
2. **Procedencia — Condiciones**.
   - EXPLICIT = el estado visible actual proviene de una afirmación de disponibilidad hecha por el usuario («Disponible» o
     «No disponible») mediante un Behavior, un `SET_STATE` o Condiciones. Cuenta aunque hoy esa UI no cree un Behavior.
   - DEFAULT = el usuario nunca afirmó una disponibilidad aplicable y Fluyo usa el estado por defecto.
   - Es metadata derivada: no se persiste.
3. **W5**.
   - Aviso no bloqueante: «La punta visible apunta en sentido contrario al flujo.»
   - Ayuda: «El flujo se calcula de origen a destino; la punta solo cambia la apariencia.»
   - No invierte origen y destino. Ni las puntas ni `flowDir` alteran la semántica.
4. **Documentación del prototipo**.
   - No entran en `main`: las tareas PROTOTYPE-001/002, las capturas, los guiones de QA ni los fixtures del prototipo.
   - Solo queda la documentación de producto destilada: este registro y la tarea.
