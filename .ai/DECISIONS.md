# DECISIONS.md — Índice de decisiones de Fluyo

Índice pequeño de decisiones que reducen trabajo repetido. No es un sistema ADR completo: una entrada = contexto, decisión y consecuencia. Solo se registran **decisiones técnicas** del proyecto open source, inferidas con alta confianza del repositorio o de su documentación; nada de estrategia comercial (repo público, ver `AGENTS.md` §9). Para proponer una decisión nueva o cambiar una vigente: tarea dedicada en `.ai/tasks/`.

**Principio rector:** mantener Fluyo radicalmente simple mientras esa simplicidad sea suficiente. Añadir complejidad —módulos ES, build tooling, dependencias, backend, otra estrategia de caché— sólo cuando exista una necesidad concreta de producto o mantenibilidad que la justifique.

**Convención de estado:**
- `vigente` — refleja el estado técnico actual y debe respetarse hasta que se decida lo contrario.
- `vigente / revisable` — es la opción actual, explícitamente **no** es una restricción permanente: puede cambiarse con una decisión nueva bien justificada.

---

## D-001 — Sin build, sin dependencias, sin backend (por ahora)

Estado: vigente / revisable

Contexto: el producto hoy promete abrirse con doble clic y no enviar datos a ningún servidor. El README y CONTRIBUTING presentan esa simplicidad como deliberada, y el historial confirma que se ha mantenido así.

Decisión: **estado técnico actual** — Fluyo se distribuye como HTML + CSS + JS vanilla, sin paso de compilación ni dependencias npm, y sin backend. No es una restricción arquitectónica permanente: build tooling, dependencias o backend pueden introducirse en el futuro si una necesidad concreta de producto o mantenibilidad lo justifica, mediante decisión explícita registrada aquí.

Consecuencia: hoy no introducir bundlers, frameworks, dependencias ni backend por defecto; el deploy es servir estáticos y la lógica (incluida la codificación del GIF) corre en el navegador. Cambiar esto exige una entrada nueva en este documento con su contexto y justificación.

## D-002 — Scripts clásicos hoy; módulos ES no descartados

Estado: vigente / revisable

Contexto: la apertura desde `file://` es hoy un caso de uso soportado y anunciado. Los navegadores bloquean `fetch()` y `<script type="module">` desde orígenes `file:` (CORS), así que los `js/*.js` se cargan como scripts clásicos en orden de dependencia y comparten ámbito global.

Decisión: **estado técnico actual** — los archivos de `js/` son scripts clásicos sin `import`/`export` de nivel superior. Esto no es prohibición permanente: si una necesidad real (mantenibilidad, tamaño del código, tooling) justifica módulos ES y/o build, se adopta con una decisión explícita y asumiendo el coste (hoy, perder la apertura directa desde `file://` salvo que haya build). Hay un test en CI (en el repo del MCP) que vigila la configuración actual.

Consecuencia: mientras dure este estado, las dependencias entre archivos se resuelven por orden de carga en `index.html` y las constantes de nivel superior son globales (riesgo de colisión). Al evaluar módulos ES en el futuro, revalidar el test y el caso `file://` como parte de la decisión.

## D-003 — Persistencia local y formato portátil `.fluyo.json`

Estado: vigente

Contexto: sin backend, el trabajo del usuario debe sobrevivir al cierre del navegador y ser compartible/versionable.

Decisión: autoguardado en `localStorage` más formato de archivo `.fluyo.json` (JSON legible, versionado con `version`, retrocompatible: campos ausentes se rellenan con defaults). El deep link `#d=` añade transporte por URL sin pisar la sesión en curso.

Consecuencia: el formato es contrato público: no renombrar claves guardadas (`shape`, `anim`, claves de `ICONS`/`ANIMS`, `fromSide`/`toSide`…), no romper apertura de archivos antiguos; cualquier cambio de formato requiere decisión explícita y migración. (Nota: la retrocompatibilidad del formato sí es una restricción durable, por los documentos ya guardados por usuarios.)

## D-004 — Telemetría mínima, condicionada y sin contenido

Estado: vigente

Contexto: se quieren métricas de uso agregadas sin traicionar la promesa de privacidad ("tus diagramas nunca salen de tu navegador").

Decisión: el script de Umami solo se carga cuando el hostname es el dominio oficial; los eventos llevan solo valores de listas cerradas (`png`, `gif`, …); nunca etiquetas, textos ni imágenes; el fragmento de URL no se envía. Cualquier cosa que envíe datos requiere issue previo (CONTRIBUTING).

Consecuencia: en local o self-host no hay telemetría; ampliar eventos exige mantener la lista cerrada y actualizar la política de privacidad.

## D-005 — Service worker cache-first con versión de caché manual (por ahora)

Estado: vigente / revisable

Contexto: el service worker es *cache-first* para funcionar offline, lo que significa que nada se revalida mientras el nombre de la caché no cambie.

Decisión: **estado técnico actual** — `sw.js` lleva una constante `CACHE` que se sube en cualquier PR que toque (añadir, quitar, renombrar o cambiar contenido de) un archivo servido. La estrategia de caché (cache-first, versionado manual, otra) no es permanente: puede cambiarse si una necesidad concreta lo justifica, con decisión explícita.

Consecuencia: mientras dure este estado, olvidar subir `CACHE` hace que usuarios vean versiones viejas, y depurar en local puede requerir unregister manual del service worker. Si se cambia la estrategia, actualizar esta entrada y la guía de `CONTRIBUTING.md`.

## D-006 — Contenido del repositorio en español

Estado: vigente

Contexto: el producto, su documentación (`README.md`, `CONTRIBUTING.md`, `docs/`) y sus mensajes de commit viven en español (con convivencia ocasional de inglés en el historial).

Decisión: la documentación interna (`.ai/`, tareas, decisiones) se genera en español.

Consecuencia: los agentes y colaboradores escriben en español por defecto.

## D-007 — Semántica y privacidad de Product Analytics v2

Estado: vigente

Contexto: FLUYO-002 detectó eventos de intención, pérdida durante la carga del proveedor y ausencia de validación central de vocabularios.

Decisión: medir resultados observables; sesión de editor equivale a una carga de página. Primera edición real por comparación local del estado editable; importación, restauración, navegación y selección no cuentan. Creación significa pasar de documento sin nodos a tener nodos mediante edición, como máximo una vez por carga. Guardar/exportar significan archivo generado y descarga iniciada, sin afirmar escritura a disco. No inferir presentación completada ni autoría MCP desde un transporte genérico.

Consecuencia: los eventos no son directamente comparables con la semántica anterior de creación/exportación. El helper valida listas cerradas y mantiene una cola acotada sólo en memoria. El filtro Umami reconstruye el payload con ruta/título constantes y sin referrer ni campos automáticos adicionales; no transmite query, hash, contenido ni IDs. Se renuncia a la atribución automática de tráfico para preservar privacidad. La política pública refleja el catálogo; eventos Share quedan reservados sin implementar. Detalle y pruebas: `.ai/tasks/FLUYO-002.md`.

## D-008 — Share Foundation: snapshot inmutable, capability URL y retirada por token

Estado: arquitectura futura diferida por D-010; diseño preservado

Contexto: FLUYO-003 diseñó la arquitectura mínima para publicar un documento Fluyo mediante una URL no enumerable y visualizarlo en un viewer read-only, manteniendo el núcleo client-side y la promesa de privacidad de D-004 salvo por esta excepción explícita y consentida. Revisión humana el 2026-09-28.

Decisión: Share persiste una copia completa **ya validada y normalizada** del `.fluyo.json` canónico bajo un ID aleatorio de 128 bits no enumerable, como snapshot inmutable (sin `PUT`/`PATCH`, sin overwrite, sin segundo esquema). El contenido solo sale del navegador tras confirmación explícita del usuario: **«Cualquiera con el enlace puede acceder a este diagrama.»** La URL del share es una *capability URL* pública, no un mecanismo de autenticación fuerte. `/s/<id>` se sirve con `noindex, nofollow` (+ `X-Robots-Tag` equivalente cuando exista backend) y `Referrer-Policy` explícita, para no ampliar su descubribilidad más allá de quien recibe el enlace. No hay expiración automática en v1 y no se promete almacenamiento permanente como SLA. La única vía de retirada propia del creador es un `deleteToken` aleatorio de alta entropía, devuelto una sola vez en la respuesta de creación, nunca persistido en claro (solo su hash) y nunca incluido en `.fluyo.json`, la URL o analytics; si se pierde, v1 no ofrece recuperación. `Open in Fluyo` siempre crea una copia local editable sin vínculo remoto con el share original. Embeds de terceros quedan fuera de v1 (`frame-ancestors 'self'`). La persistencia usa object storage + función serverless/edge; el rate limiting exige un tercer componente conceptual explícito (contador/KV), pero no se introduce una base de datos para el contenido de los shares. Los eventos `share_created`, `share_viewed` y `share_opened_in_editor` (reservados en D-007/FLUYO-002) se implementan sin IDs, URLs ni propiedades de correlación: entregan señal agregada, no un funnel individual por share, y esa limitación se acepta a cambio de la privacidad.

Consecuencia: Share es la primera excepción documentada a la promesa "tus diagramas nunca salen de tu navegador" de D-004, y solo aplica al gesto explícito de publicar. El formato `.fluyo.json` y su compatibilidad (D-003) no cambian: Share reutiliza el mismo validador/normalizador que archivo y deep link. Los límites operativos v1 (≈2 MiB, imágenes raster en lista cerrada, sin SVG ni recursos remotos) son configuración del servicio, no parte del contrato del formato, y pueden revisarse sin bump de versión. La elección de proveedor de storage/edge/rate-limit queda diferida a `FLUYO-006`. Detalle, API conceptual y arquitectura completa: `.ai/tasks/FLUYO-003.md`.

## D-009 — Transporte de analytics separado de la instrumentación del editor

Estado: vigente

Contexto: el viewer de `/s/<id>` (FLUYO-005) necesita el helper `trackEvent()` y el provider de Umami para emitir `share_viewed` y `share_opened_in_editor`, pero no debe cargar snapshots de edición ni emitir `editor_opened`. Antes de esta separación, `js/analytics.js` mezclaba ambas responsabilidades.

Decisión: `js/analytics.js` es **transporte genérico**: hosts permitidos, provider, cola, validación de eventos, `trackEvent()` y filtro de payload. `js/editor-analytics.js` es **instrumentación del editor**: snapshots de edición, `first_edit_completed`, `diagram_created` y `editor_opened`. El viewer carga solo el transporte; `index.html` carga ambos. `share_viewed` y `share_opened_in_editor` forman parte de la lista cerrada del transporte, sin propiedades ni identificadores.

Consecuencia: una nueva superficie (viewer) puede emitir eventos sin arrastrar el estado editable del editor. Modificar eventos del editor sigue siendo una operación localizada en `js/editor-analytics.js`; cambiar de proveedor sigue siendo un único bloque en `js/analytics.js`.

### Precisión de la frontera de documento tras QA de FLUYO-005

El core `model.js` no incluye fábricas que creen nodos o conexiones en el
documento activo: `newNode()`/`newEdge()` viven en `state.js`, sólo del editor.
`projectFromProjectData()` es la frontera común de validación, migración y
normalización de documento/settings para archivo, deep link y viewer;
`documentFromProjectData()` mantiene su API delegando en ella. No hay política
de versiones ni esquema separado para Share. El formato portable sigue en v3.

## D-010 — Share MVP autocontenido antes de persistencia remota

Estado: vigente / revisable

Contexto: FLUYO-004/005 permiten reutilizar el renderer read-only y la entrada
canónica. FLUYO-006 valida compartir un diagrama interactivo con coste operativo
prácticamente cero, sobre el hosting estático existente.

Decisión: snapshot canónico v3 → códec existente de deep links (deflate-raw,
versión 0 UTF-8 como fallback, base64url) → `/s/#d=<payload>`. Confirmación
explícita de copia, acceso de cualquiera con el enlace, ausencia de almacenamiento
en servidor y ausencia de revocación. Límite operativo de 65536 caracteres sobre
la URL final. Se conserva el límite defensivo de 2 MiB descomprimidos del códec;
no son límites del formato `.fluyo.json`. Viewer y editor usan
`projectFromProjectData()`; assets aportados por documentos deben ser raster
embebido (PNG/JPEG/WebP/GIF, con firma coherente) o SVG estático reconstruido por
`safe-svg.js` desde una lista cerrada. Se conserva la representación histórica
`img: data:image/svg+xml;base64,...`, sin cambio de schema. La misma frontera
rechaza scripts, handlers, foreignObject, DTD, CSS arbitrario y referencias
externas; sólo admite referencias SVG internas, raster embebido verificado y
SVG local anidado reconstruido con la misma frontera, hasta ocho niveles.
Los marcadores de flecha, textLength/lengthAdjust y aliases href coherentes del
exportador se admiten como construcciones estáticas de listas cerradas.
La UI valida antes de cargar/crear la imagen. SVG de catálogo se conserva.
`Abrir en Fluyo` reutiliza el payload válido como `/#d=`, sin reserialización ni
identidad compartida. Los tres eventos Share son agregados, sin propiedades.
Umami tiene captura automática desactivada y filtro que reconstruye URL, título
y referrer; ningún documento, hash, tamaño o ID llega a analytics.

Consecuencia: sin backend, API, storage, cuentas, sincronización, IDs remotos ni
revoke. D-008/FLUYO-003 permanecen como diseño de una posible solución persistente;
su implementación queda diferida y sólo se reconsidera si las métricas agregadas
muestran uso real de Share. Enlaces pueden quedar en historial o ser reenviados;
no son cifrado y Fluyo no puede retirarlos. Un medio externo puede truncarlos.
La política de assets se aplica también al importar archivos: SVG históricos del
subconjunto estático seguro vuelven a abrir; remotos y contenido activo se
rechazan. No cambia el esquema ni la versión del formato portable.

Resolución QA de FLUYO-006: el códec mantiene v0/v1 y recorre la estructura
DEFLATE conforme a RFC 1951 antes de la descompresión nativa para comprobar el
final exacto del único stream; sin recomprimir ni cambiar envelope. Acepta
stored/fixed/dynamic y padding final, rechaza bytes/streams concatenados y
preserva la defensa de 2 MiB. El viewer trata hashchange como nueva activación:
invalida el estado anterior, descarta cargas tardías y emite share_viewed sólo
tras el primer render de cada activación válida. Repetir el mismo payload activo
no duplica evento/RAF. ERROR deja un modelo vacío inactivo y payload nulo.

## D-011 — Scenarios: motor puro con tiempo virtual determinista

Estado: implementado en `js/scenario-engine.js`; contrato en FLUYO-007/FLUYO-008

Contexto: los resultados de un Scenario deben proceder de reglas explícitas y
reproducibles, independientemente del navegador o de la animación del diagrama.

Decisión: ejecución íntegramente local, en un módulo puro que recibe Structure,
Behavior y Scenario y devuelve Trace o errores de validación sin Trace parcial.
Tiempo virtual entero en milisegundos; cola ordenada por `(at,sequence)`, con
sequence inicial derivada del índice explícito de autoría y secuencias monotónicas
para futuros trabajos generados. Sin DOM, Canvas, almacenamiento, red, timers,
relojes reales, aleatoriedad ni estado mutable externo como fuente de lógica.
V1 limita acciones a SET_STATE/SEND y estados a UP/DOWN; SEND evalúa una sola
arista `from → to` instantáneamente, sin propagación implícita.

Cada Scenario persiste `engineVersion: 1` y Trace derivado incluye la misma
versión. Una futura versión del motor no reinterpreta silenciosamente Scenarios
antiguos: valida `engineVersion` y devuelve `unsupported_engine_version` si no
está soportada.

Consecuencia: engine comprobable en Node y mismo Trace para mismos inputs y
versión de semántica. La animación no decide resultados. Semántica exacta,
prioridad de fallos, guards y pruebas: [FLUYO-007](tasks/FLUYO-007.md) y
[FLUYO-008](tasks/FLUYO-008.md).

Precisión post-QA: Run valida toda Structure, incluidos edges no utilizados y
unicidad conjunta node/edge. Fallo siempre devuelve `{ok:false,errors:[...]}`
sin Trace; errores independientes se acumulan en orden shape/tipos/duplicados,
referencias y guards. Las cotas operativas se aplican al runner, nunca a la
validez del documento persistido. La queue v1 usa un cursor sobre copia ordenada.

## D-012 — Scenarios: definiciones persistidas, Trace derivado y playback separado

Estado: contrato técnico vigente; playback/UI no implementados todavía

Contexto: ejecutar una simulación debe conservar el documento editable y permitir
reproducir su resultado sin mezclar estado del sistema con pintura/animación.

Decisión: persistir únicamente Structure, Behavior inicial y definitions de
Scenario. Estados actuales, queue, reloj, Trace y playback viven en memoria.
Trace no se guarda en documento/autosave/URL; se mantiene junto al snapshot que
lo generó. Engine → Trace → Playback → Renderer son capas distintas. Reset
descarta runtime; nunca necesita restaurar mutations del documento porque Run
no las hace. Playback y renderer reciben datos runtime explícitos de pintura.

Consecuencia: presentación futura puede consumir el mismo snapshot/Trace sin
depender de autoría ni recalcular reglas visualmente. Cambiar inputs invalida
el resultado anterior. Export de Trace y reglas incompatibles futuras requieren
contratos versionados posteriores. Detalle: [FLUYO-007](tasks/FLUYO-007.md), §6–§10,
y [FLUYO-008](tasks/FLUYO-008.md).

## D-013 — Scenarios por página y evolución del formato a v4

Estado: implementado; `serializeProject()` emite v4 y `projectFromProjectData()`
migra v0/v1/v2/v3 a v4

Contexto: IDs existentes son numéricos y únicos por página; las páginas carecen
de identidad propia estable. El formato portable y su frontera común eran v3.

Decisión: Scenario y Behavior pertenecen a la página que los contiene, sin
cross-page ni pageId nuevo. Referencias por IDs numéricos, nunca labels. Behavior
se almacena separado del estilo como registros `{nodeId,initialState}`; ausencia
equivale a UP. Referencias eliminadas se conservan visibles como missing y
bloquean Run hasta reparación explícita. Asignación de IDs monotónica, incluyendo
undo/redo y reemplazo de página, para no retargetear referencias accidentalmente.
La implementación incorpora `behaviors`, `scenarios` y contadores de autoría en
las páginas con bump del campo real `version:3 → 4`, sin renombrar claves
existentes. Migración sobre copia en `projectFromProjectData()` para todas las
entradas; documentos antiguos reciben defaults vacíos y continúan abriendo.

Consecuencia: página sigue siendo namespace y unidad transportable. Lector nuevo
abre archivos históricos; lector v3 rechaza v4 explícitamente, sin prometer
edición sin pérdida hacia atrás. No cambia la versión del códec de enlaces.
Contrato de datos/migración/identidad: [FLUYO-007](tasks/FLUYO-007.md), §3/§8–§9,
y [FLUYO-008](tasks/FLUYO-008.md).

Precisión post-QA: persistencia válida no equivale a Scenario ejecutable.
Missing references, más de 1000 pasos y timestamps seguros sobre el guard pueden
abrirse/guardarse/compartirse sin truncar; Run queda bloqueado. Los límites de
transporte del enlace permanecen independientes. engineVersion futura positiva
se conserva si usa el contrato v4 interpretable (acciones/enums/claves actuales);
el runner no la ejecuta ni los helpers v1 de Step reinterpretan sus datos. Un
esquema futuro incompatible necesitará otra decisión de migración.

Las referencias missing de Behavior, SET_STATE, SEND y endpoints participan del
mínimo nextId. Contadores ausentes se derivan, bajos se elevan y altos se
preservan; presentes malformados o mínimos no representables se rechazan. El
máximo entero seguro es marca de agotamiento, no un ID que pueda incrementarse.
Asignación estructural, Scenario, Step y paste comprueban capacidad antes de
mutar. Duplicar selección remapea Behavior explícito con el mapa de nodos, sin
copiar Scenarios ni cambiar sus referencias; default UP continúa implícito.
