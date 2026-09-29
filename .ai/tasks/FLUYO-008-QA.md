# QA independiente — FLUYO-008

Veredicto: **CHANGES REQUIRED**.

Se revisó el working tree indicado, incluidos cambios previos de Share que ya
existían al iniciar. No se exploraron repositorios hermanos ni se modificó
producción. Los hallazgos siguientes se basan en FLUYO-007 §§3–9/14 y se
reproducen con `node --test test/scenario-independent-qa.test.cjs`.

## Hallazgos

### QA-03 — P1: referencias missing se reasignan a entidades nuevas

`js/model.js:174–176` calcula `nextId` sólo desde entidades existentes. No reserva
IDs mencionados por Behavior, SET_STATE, SEND ni endpoints faltantes.

Reproducción mínima: página vacía, `nextId:1`, Scenario con SET_STATE nodeId 1.
Importar conserva `nextId:1`; Run falla inicialmente. `newNode()` crea un nodo
distinto con ID 1 y ahora Run produce `state_changed`. La nueva entidad recibe
una acción que pertenecía a una referencia missing, sin reparación explícita.
El mismo problema existe para Behavior, SEND y endpoints. Cinco tests fallan.

Corrección requerida: elevar la marca también por todas las referencias
estructurales numéricas conservadas y comprobar entero seguro después de elevar.
Mantener referencias missing; crear entidades no debe repararlas.

### QA-01 — P1: arista colgante no usada permite Trace válido

`js/scenario-engine.js:23–50` sólo valida tipos de endpoints. La existencia se
comprueba en `:116–119`, dentro de SEND, de modo que depende de los pasos usados.

Reproducción: nodes `[1]`, edge `{id:2,from:1,to:99}`, un SET_STATE node 1.
Devuelve `ok:true` y Trace pese a que Structure es inválida. También ocurre con
Scenario vacío. §9 exige validar todas las aristas de la página.

Corrección requerida: validar endpoints de todas las aristas antes de ejecutar,
con paths de Structure y sin Trace.

### QA-07 — P1: guards de Run bloquean importación y Share de todo el documento

`js/model.js:87/95` rechaza más de 1000 steps o timestamps seguros por encima de
86400000 con `invalid_document`. Un Scenario bien formado pero fuera de cotas
operativas impide abrir, restaurar o compartir todo el diagrama.

Reproducciones: 1001 SET_STATE válidos; o uno a 86400001 ms. Ambos rechazan la
entrada antes de instalarla. `createShareUrl()` rechaza también el segundo caso.
FLUYO-007 §§8/14 requiere conservar la definición para reparación y bloquear
únicamente Run. Tres tests fallan, incluido transporte Share.

Corrección requerida: separar validez del formato de las cotas del runner. Los
límites defensivos existentes del códec/URL deben mantenerse.

### QA-02 — P2: runner acepta IDs compartidos por node y edge

`js/scenario-engine.js:46` detecta sólo repetición entre edges. No consulta el Set
de IDs de nodes. Nodes 1/2 y edge `{id:1,from:1,to:2}` producen SEND exitoso.
El normalizador del documento sí rechaza este caso: las dos fronteras discrepan.

Corrección requerida: comprobar unicidad conjunta del namespace de entidades.

### QA-05 — P2: runner no valida nextStepId

`js/scenario-engine.js:64–85` omite por completo el contador. Un Scenario con
`nextStepId` ausente, cero, negativo, fracción, string, NaN, infinito o entero
inseguro obtiene Trace. El test falla ya en el primer caso; la inspección confirma
que ninguno se consulta. §9 incluye validación del contador del Scenario.

Corrección requerida: validar el contrato propio del Scenario y la relación con
los IDs de steps, antes de ejecutar.

### QA-06 — P2: API de errores y orden de validación difieren del contrato

`js/scenario-engine.js:19` devuelve `{ok:false,error:{...}}` y cada validador corta
al primer error. El contrato acordado es `{ok:false,errors:[{code,path,stepId?}]}`,
con errores estables por fases: shape/tipos/duplicados, referencias y límites.

Reproducción: arista colgante, Behavior huérfano y dos pasos inválidos; devuelve
sólo `missing_behavior_node` y no contiene `errors`. Además, algunas referencias
se consultan antes de rechazar claves indebidas. La prevalidación sí impide
emisiones parciales para errores que actualmente detecta; no se cuestiona eso.

Corrección requerida: implementar el contrato acordado y actualizar los tests
de implementación que actualmente fijan `result.error`.

### QA-08 — P2: migración rechaza contador Step ausente en vez de derivarlo

`js/model.js:85` rechaza `nextStepId` ausente antes de calcular max step ID+1.
Scenario con step id 7 sin contador debería normalizar a 8 según §8, pero falla
con `invalid_document`. `nextScenarioId` ausente sí recibe default correctamente.

Corrección requerida: derivar el contador ausente; campos presentes malformados
siguen siendo errores. No bajar marcas superiores.

### QA-09 — P2: overflow crea contadores inseguros y IDs duplicados

`js/model.js:107/109` eleva contadores con max ID+1 sin comprobar el resultado.
Con scenario.id o step.id igual a `Number.MAX_SAFE_INTEGER`, la entrada se acepta
y devuelve un contador 9007199254740992. No es entero seguro; al reimportar puede
fallar un documento que la frontera acaba de aceptar.

Además, una página con nextId máximo seguro se acepta y las fábricas de
`js/state.js:7/21` usan `nextId++` sin guard. Tres creaciones generan IDs
9007199254740991, 9007199254740992 y 9007199254740992: duplicación y contador
inválido. Es una omisión en la garantía requerida por el incremento, aunque las
fábricas no fueran modificadas por él. Tres tests fallan.

Corrección requerida: comprobar agotamiento en normalización y asignación antes
de mutar; aplicar la misma disciplina a paste y contadores de autoría.

### QA-10 — P2: copiar/duplicar selección pierde Behavior

`js/selection.js:39/47–60` sólo captura/remapea nodes y edges. Duplicar un nodo
DOWN conserva ese override en el original; el duplicado empieza UP. §9 exige
copiar overrides de los nodos seleccionados y remapearlos con los endpoints.

Corrección requerida: incluir únicamente los Behavior de nodos copiados en clip,
remapearlos al pegar, conservar Scenarios originales y no copiar Scenarios de
selecciones parciales.

## Resultado de las áreas solicitadas

1. **Schema/migración:** layout por página y engineVersion correctos. Histórico
   sin versión y v1/v2/v3 abren; v4 roundtrip conserva definitions/marcas; v5 se
   rechaza. Normalización sobre copia e idempotente. Pruebas históricas SVG,
   raster y códec v0/v1 de Share siguen verdes. QA-03/07/08/09 impiden aprobar.
2. **Identidad:** create→undo→create para nodes/edges pasa; redo restaura identidad;
   crear/borrar/recrear Scenario/Step mantiene marcas en la edición simulada;
   undo/undo/redo de Step pasa (QA-04). Scenario/Step aún no tienen factories de
   autoría productivas, por lo que esas pruebas usan la disciplina explícita de
   contadores/undo, sin afirmar existencia de una UI. Import/reemplazo completo
   instala un namespace nuevo; clear/demo no bajan nextId. Persisten QA-03/09/10.
3. **engineVersion:** v1 produce Trace v1; v2 da unsupported_engine_version.
   Model conserva versiones futuras positivas sin ejecutarlas. Sin fallback.
4. **Pureza/determinismo:** 200 casos contra oracle independiente, inputs realmente
   deep-frozen, runs intercalados y orden incidental invertido pasan. Las 100
   repeticiones existentes pasan. Date/performance se retiran y los servicios
   externos/random tienen trampas activas. No se detectó mutación del input.
5. **Event queue:** `(at,sequence)` correcto; sequence es índice, IDs de steps no
   determinan empates. SEND terminal atómico. `nextSequence` se inicializa a N y
   está sin uso: todavía no hay enqueue de jobs generados; no se afirma que esa
   ampliación futura esté implementada. `shift()` implica coste cuadrático de
   extracción, acotado hoy a 1000 pasos.
6. **SET_STATE:** ambos cambios y no-ops correctos; inicio no emite eventos.
7. **SEND:** matriz completa, prioridad source_down, mismo timestamp, terminales
   contiguos, paralelas/self-edge y ninguna propagación pasan el oracle/suites.
8. **Validación/guards:** entradas inválidas detectadas no dejan Trace parcial;
   cotas exactas 1000 steps/2000 eventos/10000 nodes y edges/24h aceptadas.
   Excesos detectados se rechazan. Validación no está completa: QA-01/02/05/06.
   Guards runtime.jobs y trace.events son defensas internas no alcanzables por
   inputs v1 válidos (N≤1000, eventos≤2N); el test anterior de 1001 SEND prueba
   el guard de steps, no demuestra aborto del guard interno de eventos.
9. **Trace:** sólo engineVersion, scenarioId y eventos mínimos; sin labels,
   geometría, colors, snapshot ni Behavior completo. Engine no lo escribe en el
   documento. Save/autosave/Share de las definitions no incorpora runtime.
10. **Viewer:** Chrome real READY, renderer de Structure v4, Scenarios conservados,
    copia editable correcta; no engine ni factories/editor runtime adicionales.
11. **Share:** HTTP/códec/archivo/copia editable pasan con Scenarios válidos;
    suites de URL inclusiva 65536, privacidad/analytics, hashchange, ERROR cleanup,
    SVG y consumo estricto DEFLATE pasan. QA-07 bloquea definitions fuera de guard.
12. **Overhead:** mismo documento normalizado y defaults visuales en ambos lados;
    sólo difieren versión y los tres campos nuevos. +49 bytes JSON por página.
    Payloads deflate-raw v1: vacío 239→270 caracteres; pequeño 490→518;
    kafka público 1046→1075. No requiere optimización ni cambio de schema.
13. **SW/cache:** el diff real ya eleva v39→v40. Los cinco assets señalados están
    en ASSETS y se sirven cache-first; el handoff de implementación estaba mal al
    decir que no hacía falta bump. Chrome instaló v39/model v3, actualizó a v40,
    retiró v39, recargó y verificó model/Share v4 en caché. No se cambió estrategia.
14. **Engine en browser:** no está en index, viewer ni precache, correcto para
    este alcance. No se añadió carga productiva.
15. **file://:** smoke real PASS: importar v4, guardar, editar/undo, Scenario
    preservado, sin engine cargado. No se ejecutó una UI Scenario inexistente.

## Pruebas, mutaciones y alcance

- 123/123 tests Node de implementación/Share/viewer/analytics PASS.
- `node test/render-boundary.cjs`, `node test/render-boundary-run.cjs`,
  `node test/editor-runtime.cjs`: PASS.
- `node --test test/scenario-independent-qa.test.cjs`: **28 tests, 11 PASS,
  17 FAIL** que reproducen nueve defectos; no TODO/skips.
- `node test/scenario-qa-mutations.cjs`: 7/7 detectadas en copias temporales:
  tie-break por step.id, nextId decreciente, engineVersion sin validación,
  acción desconocida admitida con campos válidos de SEND, mutación Behavior,
  pérdida Scenario en model/viewer y ejecución engine desde viewer.
- `node test/scenario-qa-overhead.cjs`: PASS, tamaños anteriores.
- `node test/scenario-qa-browser.cjs` con NODE_PATH al Playwright disponible del
  entorno: PASS HTTP, file y upgrade SW; cero pageerror; analytics bloqueado.
- Los browser gates antiguos `share-browser.cjs`/`share-post-qa-browser.cjs`
  contienen hardcodes v39 y requieren proveedor Umami capturado. No se declaran
  ejecutados ni verdes sobre este diff; el nuevo gate prueba v39→v40 real. El
  proveedor Umami real no se revalidó en Chrome en esta sesión: las regresiones
  de privacidad ejecutadas son Node y el browser smoke local bloquea analytics.
- No se desplegó ni se validó hosting en producción; no se ejecutó playback/UI.

Las mutaciones se ejecutan exclusivamente en `os.tmpdir()` y se limpian al
terminar. Los archivos productivos permanecen intactos. Correcciones propias:
documentación del estado y del bump SW; nuevas pruebas de QA. Sin UI, dependencias
del producto, commit o push.

Recomendación final: mantener **FLUYO-008 CHANGES REQUIRED**. Corregir primero
QA-03, QA-01 y QA-07, completar P2 y repetir suite independiente, regresiones y
Chrome. No avanzar a FLUYO-009 como continuación de este QA.
