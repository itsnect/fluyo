# FLUYO-005 — QA independiente

Fecha: 2026-09-28. Veredicto original: **CHANGES REQUIRED**.

Veredicto vigente: **APPROVED**, tras el re-QA final del mismo día sobre los
cinco hallazgos y su regresión mínima. Véase «Re-QA final» al final. El informe
original y el seguimiento se conservan como evidencia histórica.

Se revisaron el diff pendiente, el shell, core, loader, viewport, runtime,
analytics, estilos y pruebas relevantes. No se hicieron commits ni pushes.

## Hallazgos funcionales pendientes

| Prioridad | Hallazgo | Evidencia y corrección requerida |
|---|---|---|
| P1 | El runtime contiene operaciones de creación | `model.js` define `newNode()` y `newEdge()`, que mutan `P().nodes`, `P().edges` y `nextId`. En el harness real del viewer, ejecutar ambas cambió 2 nodos a 3 y 1 flecha a 2. Mover estas fábricas al runtime del editor y añadirlas a los globals prohibidos. No hay handlers de edición, pero no se satisface la exigencia de ausencia de código mutable. |
| P1 | Validación insuficiente antes del render | Una copia del fixture con `doc.cur=99` pasa el loader y falla en `getBounds()`; con `doc.theme="desconocido"` pasa y falla en `render()` al leer `T.bg`. El status ya está vacío. El loop programa el siguiente RAF antes del render y no maneja la excepción, por lo que el fallo puede repetirse y dejar dibujo parcial. Validar/normalizar todos los campos necesarios para render y convertir fallos en estado terminal sin render parcial. No crear otro esquema de documento. |
| P2 | IDs inválidos abren la demo | `s/index.html?s=!!` y `?s=demo!` cargan 2 páginas y emiten `share_viewed`. El parser descarta o trunca caracteres y el fallback abre `demo`. Leer parámetros completos y reservar la demo para ausencia real de ID. Comprobar propiedades propias de `SHARE_FIXTURES`, evitando claves heredadas como `constructor`. |
| P2 | Rechazo de versiones históricas soportadas por el importador | `loadSharedDocument()` rechaza todo `version!==3`, antes de llamar al normalizador que sí migra `state.nodes`. Un documento legado con `version:1`, `state:{nodes:[],edges:[]}` y `settings:{}` produjo `unsupported_version`. Alinear la compatibilidad con el importador; el rechazo debe corresponder a versiones desconocidas. |
| P2 | Pinch pierde el ancla al trasladar los dos dedos | Desde punteros (100,100)/(200,100), mover ambos +50 px debe conservar zoom y desplazar cámara +50 px. El harness obtuvo desplazamiento -25 px. Se recalcula el mundo bajo el punto medio nuevo en cada evento, en lugar de conservar el ancla inicial o trasladar desde el punto medio anterior. |

Estos cambios necesitan corregir la frontera/validación y verificar invariantes.
La sesión de QA limitó las modificaciones productivas a ajustes visuales pequeños.

## Independencia, navegación y presentación

- El shell carga exactamente `config`, `model`, `geometry`, `render`, transporte de analytics, loader y los dos scripts del viewer. No carga ninguno de los módulos del editor prohibidos. No usa localStorage/sessionStorage, autosave, importar, guardar ni exportar. La excepción a read-only son las fábricas descritas arriba.
- Cambiar página modifica `doc.cur` como estado de vista; no añade, renombra ni elimina páginas. Nombres mediante `textContent`; labels dibujados en Canvas.
- Pan, zoom con cursor, botones +/- y fit funcionan en sus pruebas. Resize actualiza dimensiones de Canvas cada frame; no vuelve a encajar automáticamente una presentación al cambiar el tamaño. Debe comprobarse en móvil junto con el pinch corregido.
- Reloj propio y pausa independientes del editor. `settings.build` reinicia el reloj al entrar y cambiar diapositiva. Navegación y salida de presentación comprobadas en navegador; viewport restaurado en el test. El handler de `fullscreenchange` sale del modo cuando el navegador abandona fullscreen. No se certificó fullscreen nativo ni táctil físico.
- Las listeners se registran una vez durante el bootstrap normal. El riesgo observado del loop es la repetición de excepciones tras documentos aceptados incorrectamente.

## Loader y Open in Fluyo

La interfaz `{doc,settings}` y `Error.code` permite conectar una fuente HTTP de
mismo origen sin rediseñar el viewer. Se usa el formato `.fluyo.json` y su
normalizador, sin esquema paralelo. Los fixtures viven en el loader, no en el
renderer, aunque la excepción de ID de demo está acoplada a `SHARE_FIXTURES`.
`settings` se copia y combina con defaults, pero no se valida ni normaliza por
tipos/rangos; también debe cubrirse al resolver la validación pendiente.

`#d=` entrega bytes de una copia, sin ID remoto ni posibilidad de escribir al
share. Compresión y decodificación pasan en Node. Se comprobó además el clic
real y la llegada al editor con las dos páginas del fixture. Primero hubo
recursos antiguos en la caché HTTP; tras renovarlos mediante el harness de
documento entrante, el flujo funcionó. **No certificar documentos grandes:**
el fragmento puede ser demasiado largo y el decoder limita el JSON a 2 MiB.
FLUYO-006 debe sustituir el transporte por `/#s=<id>`.

## Analytics, privacidad y seguridad

- El diff mueve intactas las funciones de instrumentación a `editor-analytics.js`; el transporte conserva los eventos anteriores y añade los dos del viewer. Pruebas de analytics: 13/13.
- `share_viewed` se emite una vez después de un render que retorna sin excepción. `share_opened_in_editor` sólo está en el handler del clic. No se envían ID, URL, títulos, nombres, tamaño ni propiedades libres; el filtro reconstruye el payload con listas cerradas.
- `robots=noindex,nofollow`, referrer `no-referrer` y CSP presentes. El CSS compartido funciona bajo `style-src 'self'`. Imágenes data/blob y SVG de iconos están permitidos; imágenes externas arbitrarias no están permitidas por `img-src`.
- El normalizador aún acepta `node.img` libre; la CSP bloquea otros orígenes pero permite rutas del mismo origen. La validación de contenido e imágenes sigue siendo necesaria antes de recibir documentos públicos.
- `frame-ancestors` requiere cabecera HTTP y sigue pendiente para FLUYO-006, junto con `X-Robots-Tag`. No se añadió al meta CSP.

## Estados de error

Fixture válido, `invalid_id`, `not_found`, `invalid_document`,
`unsupported_version` y `unavailable` cubiertos por pruebas de loader/runtime.
Se añadió el caso de fuente desconectada, sin render ni analytics. Las URLs
malformadas y los documentos estructuralmente aceptados pero no renderizables
son las excepciones pendientes descritas arriba. Los controles superiores se
ven habilitados en error aunque no se les hayan conectado handlers:
**inconsistencia menor pendiente**.

## Consistencia visual con el editor

Comparación ligera por código y capturas reales de escritorio del viewer y
editor. No hubo rediseño. El viewer carga `identity.css` y `share.css`; no carga
`styles.css` ni runtime editable.

| Clasificación | Diferencia | Resultado |
|---|---|---|
| Bug visual | Wordmark sans serif, azul, en negrita y sin los tres puntos | Corregido: mismo wordmark Georgia, cobre, peso y puntos del editor; nombre accesible Fluyo. |
| Inconsistencia menor | Fondo, paneles, muted y acento distintos | Corregido: variables compartidas del editor. |
| Inconsistencia menor | UI 14 px sin el line-height del editor | Corregido: misma fuente 13 px/1.45 compartida. |
| Inconsistencia menor | Botones con otros radios, padding, hover, focus y color primario | Corregido: reglas comunes del editor, radio 7 px y focus azul secundario. |
| Inconsistencia menor | Tabs azules redondeadas en lugar de estados cálidos del editor | Corregido: colores, padding, tamaño y radios superiores del editor; desplazamiento horizontal para nombres largos. |
| Inconsistencia menor | Padding/gap de barra superior distintos | Corregido: 8 px 14 px y gap 8 px. Los controles de vista permiten wrap en pantalla estrecha. |
| Bug visual | Página vacía invita a elegir una forma y editar | Corregido: `emptyHint` opcional del renderer; viewer dice «Esta página no contiene elementos.». El editor mantiene su hint original. |
| Mejora futura | Tabs arriba en viewer y abajo en editor; barra de presentación con distribución distinta | Aceptable para el alcance: conservar layout mínimo de lectura y revisar después si existe una necesidad de uso. |
| Mejora futura | Naming de controles de presentación usa palabras y el editor usa algunos símbolos | «Presentar», «Página», «Abrir en Fluyo» y branding son coherentes; unificar iconografía si se extraen componentes de presentación. |

La acción principal continúa siendo «Abrir en Fluyo» y el lienzo conserva la
mayor jerarquía. No se copiaron controles de edición ni la hoja completa del
editor. Se intentó viewport 375×667, pero el navegador integrado siguió
reportando 1280×720: **no contar ese intento como QA móvil aprobado**.

## Pruebas ejecutadas y límites

- `node --test test/viewer.test.cjs`: inicialmente 16/16; después 18/18. Se corrigió el mock de RAF para ejecutar todos los callbacks de cada frame, no sólo el último, y se añadieron fuente no disponible y reinicio de build.
- `node test/render-boundary.cjs`, `node test/render-boundary-run.cjs`, `node test/editor-runtime.cjs`: PASS.
- `node --test test/analytics.test.cjs`: 13/13 PASS.
- `node --check` sobre `js/*.js`, `sw.js`, `test/*.cjs`: PASS.
- `git diff --check`: PASS, con avisos de LF/CRLF del checkout Windows.
- Navegador HTTP: documento/importación 38/38; edición inline 51/51; viewer visible, animación, tabs, entrada/salida de presentación, copia editable, editor Guardar y exportación PNG sin fallo observado, presentación del editor.
- Los tests verdes **no prueban ausencia de todas las operaciones mutables**: faltan `newNode/newEdge` en la lista prohibida. El Canvas del test de viewer es un Proxy permisivo, aunque el test de frontera de render usa un mock más estricto. No cubren entradas con cur/tema/settings inválidos ni traducción conjunta de pinch. Reproducciones independientes del harness confirmaron los cinco hallazgos funcionales.
- SW incluye assets del viewer y nuevo CSS común; cache subida de v34 a v35 por estos cambios. Limpieza de cachés antiguas preservada. No se verificó una actualización offline completa de PWA ni el editor `file://` en navegador. Los scripts siguen siendo clásicos y las nuevas hojas usan rutas relativas.

## Archivos modificados por esta QA

`css/identity.css`, `css/styles.css`, `css/share.css`, `index.html`,
`s/index.html`, `js/render.js`, `js/viewer.js`, `sw.js`,
`test/viewer.test.cjs`, `test/documento-entrante.html`, esta revisión y el handoff
de `FLUYO-005.md`. Los cambios previos de implementación se conservaron.

## Estado final recomendado

**IN REVIEW — CHANGES REQUIRED.** Cerrar primero los hallazgos P1/P2, ampliar
los tests sobre sus invariantes, comprobar móvil/fullscreen y actualización de
PWA, y repetir QA. No iniciar FLUYO-006 como parte de esta revisión.

## Seguimiento de correcciones — 2026-09-28

| Hallazgo | Corrección y evidencia |
|---|---|
| APIs mutables cargadas | Fábricas movidas a `state.js`; globals prohibidos y test de frontera incluyen `newNode/newEdge`. Viewer sólo carga el core de documento. |
| Normalización/compatibilidad | Una frontera `projectFromProjectData()` para editor y loader. Cur normalizado, settings con defaults/rangos del editor, enums/geometría/arrays comprobados antes del render. Versiones históricas y falta de settings admitidas; versiones futuras rechazadas en el core. Fuente copiada, IDs/nextId normalizados. |
| Pinch con traslación | Ancla inicial de mundo y centro actual mediante matemática pura; tests de separación, pan, combinación y levantar/cancelar un dedo. |
| IDs que abrían demo | Parser completo sin fallback; demo explícita y lookup propio. Tests de demo, inválidos, vacío/ausencia, ID válido inexistente, path/hash y claves heredadas. Navegador muestra invalid_id para `!!` y `demo!`. |
| Fallos de preparación/render | Ready y share_viewed posteriores al primer render. Error terminal, limpieza de canvas/tabs, controles deshabilitados y fin del loop; tests de render inicial, bounds y fallo posterior. |

La inconsistencia menor de controles habilitados en error quedó corregida.
Identidad y hint read-only del QA se preservaron; SW pasó de v35 a v36 para
invalidar contenido servido modificado conforme a `AGENTS.md`.

Resultados: viewer 28/28, analytics 13/13, fronteras/runtime/sintaxis/diff-check
PASS; normalización de 11 fixtures/ejemplos PASS. Browser: importación 38/38,
editor inline 51/51, demo/páginas/presentación/errores/copia editable correctos.
Persisten los límites de dispositivo físico, fullscreen nativo, `file://` y
actualización offline PWA. Estado: **listo para re-QA**, sin aprobación
independiente nueva, backend, tarea nueva, commit ni push.

## Re-QA final — 2026-09-28

**APPROVED.** Revisión limitada a los cinco hallazgos corregidos y las
regresiones mínimas solicitadas. No se repitió la auditoría completa.

| Hallazgo solicitado | Resolución verificada |
|---|---|
| 1. Core read-only | `newNode/newEdge` viven únicamente en `state.js`, con sus implementaciones originales. El shell productivo del viewer no lo carga y ambas APIs son inexistentes en su runtime VM. El editor conserva las fábricas y sus pruebas reales de edición pasan. Modelo y serialización v3 compartidos, sin esquema duplicado. |
| 2. Documento entrante | Loader y `applyProjectData` delegan en `projectFromProjectData`. Entrada actual, migración histórica, versión futura, cur, tema, tipos/rangos de settings y defaults comprobados; normalización sobre copia antes de preparar/renderizar. Las páginas inválidas se rechazan aunque no sean la activa. Sin compatibilidad especial de Share. |
| 3. Pinch | Separar dedos conserva el ancla y cambia zoom; trasladarlos conserva zoom y mueve cámara; movimiento combinado conserva el punto de mundo bajo el centro; levantar/cancelar vuelve a pan estable. Matemática pura y eventos del runtime comprobados. |
| 4. IDs | Demo sólo por `demo` exacto. `demo!`, `!!`, ausencia/vacío y entradas mal formadas producen invalid_id. ID público válido de 22 caracteres supera validación y obtiene not_found del adapter local. Parser completo, sin fallback. |
| 5. Estados/analytics | Primer render todavía en loading; ready y share_viewed posteriores al éxito. Fallos de preparación y primer render dejan error visible, canvas limpio, tabs ocultas y controles bloqueados, sin evento ni loop. Fallo posterior termina el RAF y conserva únicamente el evento legítimo ya emitido. Máximo un share_viewed por carga normal. |

### Pruebas repetidas

- `node --test test/viewer.test.cjs test/analytics.test.cjs`: **41/41 PASS** (28 viewer + 13 analytics).
- `node test/render-boundary.cjs`, `node test/render-boundary-run.cjs`, `node test/editor-runtime.cjs`: **PASS**.
- `node --check` en `js/*.js`, `test/*.cjs` y `sw.js`: **PASS**.
- `git diff --check`: **PASS**, sólo avisos LF/CRLF del checkout Windows.
- Navegador integrado, servidor HTTP nuevo con no-store: **importación 38/38**, **edición inline 51/51**. Demo, tabs, controles de zoom/encajar, presentación/navegación/salida y Abrir en Fluyo como copia editable comprobados. Editor presenta las dos páginas importadas; flujo de copia sin errores de consola.
- IDs originales `?s=demo!` y `?s=!!` comprobados en navegador: error visible, Presentar/Abrir/controles de vista deshabilitados.
- Comparación ligera de capturas editor/viewer: wordmark, tipografía, paleta, botones y tabs conservan identidad compartida. Ambos shells referencian `identity.css`; viewer conserva sólo su CSS de layout.
- SW **v36**: los **41 assets** de las dos listas existen; core/editor, identidad, scripts y CSS del viewer incluidos. Serialización `.fluyo.json` sigue v3; los **8 ejemplos** guardados vuelven a pasar normalización.

### Sensibilidad de las regresiones

Se reintrodujeron **8 mutaciones equivalentes en memoria**, interceptando la
lectura de fuentes del harness, sin escribir archivos productivos: exposición
de factories, eliminación de normalización de cur, eliminación de validación
de theme, bypass de settings, rechazo histórico sólo en Share, pinch anclado
al centro actual, parser con fallback a demo y ready anterior al primer render.
Los tests correspondientes detectaron cada mutación. Esto confirma cobertura
de los cinco defectos anteriores; no equivale a probar todos los inputs posibles.

### Cambios, límites y cierre

Este re-QA sólo actualizó esta revisión y el handoff de `FLUYO-005.md`; no
necesitó correcciones de código ni nueva versión de cache. Sin commit, push,
tarea nueva ni trabajo de FLUYO-006.

Quedan sin certificar táctil físico, fullscreen nativo, editor `file://` y
ciclo completo de actualización offline de PWA. La coherencia de assets v36
se verificó por código, no mediante un upgrade offline. El adapter continúa
siendo local, como define el alcance de FLUYO-005. Ninguno de estos límites
reabre los cinco hallazgos verificados.

Estado final recomendado: **DONE — APPROVED**. Cerrar FLUYO-005 y conservar
los límites de cobertura anteriores para su comprobación en ese entorno.
