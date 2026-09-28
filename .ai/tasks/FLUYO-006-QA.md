# QA independiente — FLUYO-006

**Resultado vigente de re-QA:** APPROVED WITH MINOR FIXES, corrección menor SVG
aplicada y 74/74 PASS. Ver sección «Re-QA final» al final de este documento.
La auditoría inicial siguiente se preserva como histórico de Q1–Q4.

Fecha: 2026-09-28. Veredicto: **CHANGES REQUIRED**.
Evaluado el working tree sin commit/push, backend ni continuación de FLUYO-007.
Bootstrap limitado a AGENTS, tarea, DECISIONS y diff; expansión dirigida.

## Hallazgos que requieren cambios

### Q1 — P1: el editor guarda SVG que su importador rechaza

`js/model.js:135` exige raster base64 en la frontera común. Antes de esta tarea
aceptaba SVG embebido y URLs externas. `addImageFromBlob()` en
`js/interaction.js:891` sigue aceptando `image/svg+xml` mediante la UI,
FileReader e Image; `saveJSON()` guarda el URI sin convertirlo.

Reproducción en Chrome real: insertar un SVG local sencillo mediante `#imgIn`,
Guardar, vaciar documento, Abrir el archivo descargado. Con model de HEAD:
1 nodo reimportado, sin alerta. Con model actual: 0 nodos y «El archivo no es un
diagrama Fluyo válido». No es sólo una capacidad teórica de JSON escrito a mano.
Deep links con esos mismos assets también se rechazan. La restauración que
pasa por esa frontera está expuesta a la misma incompatibilidad.

El aislamiento de recursos no confiables sí es necesario en Share, pero romper
el roundtrip de un SVG local previamente soportado no lo es. D-003 exige
compatibilidad; D-008 separaba límites de assets del contrato del formato.
Cambiar D-010/documentación no elimina la regresión. Se necesita una solución
segura que conserve archivos históricos, sin ejecución SVG ni requests
controlados por contenido. No basta retirar la comprobación ni agregar a ciegas
SVG/remotos a una whitelist. No se implementó conversión/sanitización ad hoc
durante este QA por su alcance y efecto sobre el contrato compartido.

### Q2 — P1: URL y documento divergen al cambiar el hash

`js/viewer.js:255` sólo arranca por DOMContentLoaded; no procesa cambios del
fragmento. Abrir Share A y navegar a Share B en la misma pestaña, misma ruta,
no recarga el documento. URL B muestra A; `viewerPayload` sigue siendo A y
Open in Fluyo construye `/#d=A`. Navegar a un hash corrupto tampoco produce
ERROR cuando ya había un Share cargado. La carga nueva de B sí funciona.

Gate real: `test/qa-share-hash-browser.cjs`, Chrome sin SW. Resultado actual:
`expected: Snapshot B`, `actual: Snapshot A`, `copyMatchesB: false`.
Corregir navegación/hashchange y coherencia de estado/CTA, incluyendo atrás y
adelante y hashes inválidos. Mantener como máximo un evento visto por carga.

### Q3 — P2: basura posterior a deflate se acepta como Share válido

`js/link-codec.js:20` limita salida, pero no comprueba consumo íntegro del
stream. Base64url canónico de `[v1, stream válido, 0, 0, 0]` llega a READY y
emite share_viewed. También se observaron sufijos `A` y `AAAA` aceptados sobre
un payload v1 concreto. Un sufijo ilegal `!` sí falla.

No hubo fallback ni cambio del JSON original, pero se incumple el rechazo de
payload corrupto/con caracteres adicionales. El test original sólo trunca
o añade caracteres fuera del alfabeto. Añadir validación de integridad que
preserve streams históricos; comparar sólo con una recompresión propia podría
rechazar streams legítimos de otros encoders.
Esta tolerancia se hereda del decoder anterior; se reporta porque el nuevo
transporte Share exige explícitamente probar y rechazar estos casos.

### Q4 — P2: ERROR no elimina el modelo/payload instalados

`showShareError()` en `js/viewer.js:46` limpia canvas/tabs y bloquea controles;
no borra doc, settings ni viewerPayload después de instalarlos. Fallar el
primer render deja los 5 elementos de demo y el payload en memoria.
Los tests existentes verifican UI/RAF/eventos, no esta limpieza.
No se observó fuga externa ni edición habilitada. Limpiar el estado parcial y
probarlo sin convertir el error en demo.
La limpieza incompleta ya estaba en el viewer previo; FLUYO-006 conserva ese
incumplimiento de su criterio de aceptación.

## 1. Veredicto

CHANGES REQUIRED: Q1/Q2 bloquean el cierre; Q3/Q4 incumplen criterios expresos.

## 2. Arquitectura y alcance

Frontend estático y scripts clásicos. No se añadió API, función serverless,
Cloud Run/Cloudflare/Vercel Function, database, object storage, Firebase,
Supabase, Redis, auth ni servicio remoto nuevo. Umami/CDN ya existían.
Sin share.json, schema paralelo ni ID ficticio. D-010 contiene decisiones
técnicas públicas, sin pricing/estrategia/métricas privadas. D-008 y referencia
FLUYO-003 permanecen; persistencia diferida.

## 3. Códec y compatibilidad

Extracción común de encode/decode/compress/decompress, compartida por editor y
viewer. v0 UTF-8 y v1 deflate-raw pasan; documentos v1/v2/v3 y legacy sin version
normalizan; v4 termina en ERROR. Base64 inválido/vacío/duplicado y truncado
fallan. 2 MiB se verifica por bytes UTF-8; bomba v1 y exceso v0 se rechazan.
Pendientes Q1 y Q3. No se comprobó toda la matriz de APIs de navegadores.

## 4. Snapshot e inmutabilidad

PASS A → crear enlace → editar original B → contexto limpio muestra A → Open
in Fluyo → copia modificada C → viewer conserva A. Copia profunda síncrona
antes del primer await; sin local/session storage del creador ni escritura al
Share. Hay coherencia con los bytes iniciales salvo navegación de Q2.

## 5. Construcción y límite de URL

`new URL('/s/', base)` usa origen actual, elimina pathname/query anteriores y
preserva protocolo/puerto. HTTP localhost, trailing slash, ruta anidada y HTTPS
con puerto pasan. Sin hardcoding de fluyo.space. Fragmento exclusivo `#d=`.
65535 y 65536 permitidos; 65537 rechazado sobre URL final. URL serializada ASCII
(payload base64url y percent-encoding/punycode de URL), por lo que `.length`
coincide con bytes en este transporte. Sin uploads/fallback remoto; rechazo
conserva exportación como alternativa y no emite creación.

## 6. UX Share

Abrir/cancelar no crea; confirmar crea una URL/evento; doble clic bloqueado.
Snapshot corresponde al clic Crear enlace después de commitEditBox, no al abrir
el diálogo. Cambio programático mientras está abierto quedó en el snapshot al
confirmar. Tres aperturas/cancelaciones consecutivas pasaron. URL visible y
seleccionable; clipboard exitoso confirmado por lectura real; rechazo real y
API ausente conservan URL e indican copia manual, sin falso éxito.

## 7. file://

Chrome real: carga de editor, crear nodo y Present PASS. Crear enlace bloqueado
con mensaje web; builder rechaza file. Sin excepciones pageerror nuevas.
No se certificó ausencia de todos los mensajes console/resource preexistentes.

## 8. Viewer y estados

En carga nueva: extract → decode → decompress → parse → validar/migrar/
normalizar copia → primer render → READY. Sin demo silenciosa; demo explícita
por query sigue siendo fixture. Fallos previos/de primer render bloquean
Present/Open y no emiten visto, limpian canvas y cesan render/RAF recurrente.
Se provocó un fallo natural de render con icon constructor y tint en Chrome:
ERROR sin pageerror. Pendientes Q2 (hash no procesado) y Q4 (memoria residual).

## 9. Open in Fluyo

Carga nueva `/s/#d=X` → `/#d=X`, payload validado reutilizado sin reserializar,
copia editable y conflicto de sesión existente preservado. Cambiar página del
viewer no cambia los bytes. Sin identidad de Share ni `#s=id`. Q2 abre A ante B.

## 10. Analytics

Creación únicamente después de confirmación/serialización/URL/límite exitosos;
vista después de render; abrir editor por interacción explícita. Sin propiedades.
Originales y mutaciones validan las tres semánticas. Q3 puede contar una carga
con bytes extra tolerados; Q2 conserva estado/evento de la carga anterior.

## 11. Privacidad y marcador

Se descargó el script actual `https://cloud.umami.is/script.js` y ejecutó en
Chrome con origen oficial simulado. Requests de provider interceptados y
resueltos localmente, sin enviar telemetría real. Captura de URLs, headers,
bodies/referrer y petición inicial HTTP: 0 apariciones de
FLUYO_PRIVATE_MARKER_12345, payload, su marcador base64 o `#d=`.
Tres eventos observados una vez; URL `/`, título `Fluyo`, referrer vacío.
Auto-track false/exclude hash/search y before-send real ejercitados; no se
observó pageview ni captura automática. No es sólo mock del wrapper.

## 12. Seguridad de documento

Label y nombre de página `<img src=https://qa.invalid/... onerror=alert(1)>`
en navegador real: contenido conservado como texto, sin elemento img, diálogo
ni request a qa.invalid. Viewer usa canvas/textContent, sin eval/new Function ni
innerHTML de documento. Assets raster embebidos admitidos; remotos/SVG de img
rechazados por política actual. Esto no constituye una auditoría exhaustiva de
todos los campos del modelo ni un certificado general de seguridad.

## 13. Imágenes remotas/SVG

Q1: cambio real de compatibilidad. HEAD aceptaba ambos; render cargaba img por
Image.src. Remote JSON era capacidad existente aunque no se encontró UI dedicada
para introducir URL remota; SVG local sí tiene flujo UI reproducido.
El endurecimiento afecta archivo/import/deep link y entradas compartidas; los
ocho ejemplos publicados no tienen img y normalizan con el modelo actual.
Iconos SVG del catálogo conservados. Se requiere preservar SVG histórico de
forma segura y explicitar tratamiento de remotos; seguridad no justifica
declarar compatibilidad intacta.

## 14. Independencia read-only

Shell sólo carga config/model/codec/geometry/render/analytics/loader/viewport/
viewer. Sin state, factories editoriales, runtime, interaction, selection, ui,
export ni autosave. Globals editoriales ausentes en Chrome limpio y harness.
Mutación que añade state.js al shell fue detectada.

## 15. PWA/service worker

v37 y los assets nuevos existen; instalación nueva y viewer offline PASS, sin
documentos/hash en cache. Upgrade de activos HEAD/v36 a working tree/v37 probado
en contexto real: esperar worker activated, v36 eliminada, sólo v37; shell y
loader actuales y viewer offline READY. Durante instalación puede seguir activo
v36; no se debe confundir aparición de cache v37 con activación completada.
No se modificó SW porque QA sólo añadió tests/documentación, no assets servidos.

## 16. Hosting

No se encontró configuración Vercel/rewrite de deploy en este repo. Estructura
`s/index.html` funciona con servidor estático de prueba. GET producción `/s/`
respondió 200, pero su HTML corresponde al shell anterior (sin link-codec).
No es validación de esta implementación desplegada. Verificación manual
obligatoria post-deploy/pre-release de `/s/#d=`, assets y cabeceras; sin migración.

## 17. Regresiones editor

Crear/editar/mover/conectar: harness editor 51/51. Importar/deep link/conflictos:
38/38. Present/Share/copia: Chrome real. Guardar: archivo descargado e importación
comparados; raster/documentos comunes pasan, SVG falla Q1. PNG y SVG exportados
realmente con descarga (PNG comprobado por firma). No se certificó aquí GIF/JPG
visual ni dispositivos móviles.

## 18. Tests ejecutados

- `node --test test/share.test.cjs test/viewer.test.cjs test/analytics.test.cjs`: 50/50 PASS.
- render-boundary, render-boundary-run y editor-runtime: PASS.
- node --check JS/SW/CJS y git diff --check: PASS.
- share-browser con Umami actual: PASS, incluidos 38/38 y 51/51.
- Chrome independiente: SVG baseline/actual, XSS, clipboard rechazado,
  cancelaciones, momento snapshot, export PNG/SVG, hash A/B, render y upgrade.
- `node --test test/qa-share.test.cjs`: 3 PASS, 3 FAIL confirmados (Q1/Q3/Q4).
- `node test/qa-share-hash-browser.cjs`: FAIL confirmado (Q2, requiere NODE_PATH
  al Playwright del entorno, como share-browser).

Los gates nuevos fallan intencionadamente ante requisitos incumplidos y deben
pasar tras corregir runtime; no se ajustaron para aceptar el comportamiento roto.

## 19. Mutaciones y adversariales

Ocho mutaciones en copia temporal aislada: permitir 65537, evento al abrir
diálogo, analytics location.href, auto-track true, fallback demo, evento antes
de render, falso éxito clipboard y state.js en shell. Las ocho produjeron
fallos relevantes en suites originales. Se restauró cada copia; working tree
de producto no mutado. Suites verdes originales no detectaban Q1-Q4: incluso
el test original de assets exige el rechazo que produce la regresión Q1.

## 20. Correcciones realizadas

Sin correcciones de runtime: se preservó el código revisado para no resolver
ad hoc el contrato de assets ni rediseñar transporte. Añadidos este informe y
dos gates de regresión, y actualizado el estado/handoff de FLUYO-006.
Sin cambios en D-010, formato, infraestructura o cache.

## 21. Riesgos restantes

Q1-Q4; enlaces largos truncables por clientes; APIs de compresión/clipboard
según navegador; Safari/Firefox y matriz móvil/táctil no ejecutados; hosting
actual todavía no desplegado. Umami remoto puede cambiar: repetir aceptación
con script actual antes de release. URL contiene contenido codificado, sin
cifrado, revocación ni persistencia remota. No se construyó workaround backend.

## 22. Estado final recomendado

**CHANGES REQUIRED**, no cerrar FLUYO-006. Resolver Q1/Q2 y requisitos Q3/Q4,
repetir gates rojos y suites originales, y verificar hosting tras despliegue.
FLUYO-007 permanece sin iniciar.

---

## Re-QA final — 2026-09-28

### 1. Veredicto

**APPROVED WITH MINOR FIXES**. Q1–Q4 no pudieron refutarse en los escenarios
revalidados. Se encontró y corrigió un rechazo adicional del SVG generado
por el exportador de Fluyo. Bootstrap: AGENTS, tarea, este informe, diff y
lecturas dirigidas; no se repitió la auditoría completa anterior.

### 2. SVG roundtrip

Chrome: insertar SVG rojo → guardar archivo descargado → importar → imagen
nativa RGBA [255,0,0,255] → PNG/SVG descargados → Share renderizado PASS.
SVG vectorial generado por la UI ahora puede insertarse como imagen; export
con código/icono/SVG local anidado supera normalización idempotente y render
nativo con píxel rojo. Compatibilidad: misma clave img/data URI base64,
schema v3, proyectos históricos y deep links v0/v1.

### 3. Seguridad SVG

Revisión del tokenizer XML restringido, pila de elementos/raíz única y
reconstrucción escapada desde listas cerradas; no se carga el XML original
como HTML. Scripts, on*, foreignObject, DTD/custom entities, javascript,
URLs externas, namespaces ajenos, CSS arbitrario y MIME falso rechazados.
La ampliación del exportador sólo admite marcadores y atributos estáticos,
alias href iguales y SVG data URI reconstruido recursivamente (máximo ocho
niveles). Alias contradictorios, anidación excesiva y ataques dentro de
SVG anidado también fallan. No se admiten filtros ni estilos globales.

### 4. Navegación

A → B → A, atrás/adelante, A → inválido y ERROR → C PASS. Chrome con documentos
de varias páginas confirma tabs B1/B2, página B2 y viewport idéntico a B abierto
en contexto limpio después de alterar página/zoom de A. CTA abre B editable.
Tras ERROR, C vuelve a READY y se abre editable. Sin mezcla de modelo/settings.

### 5. Carreras

Nueve tests adicionales incluyen A lenta → inválido → C con éxito y fallo
obsoletos; A/B pendientes resueltos después de C en orden inverso; CTA atrasada
de A no navega tras B. Sólo la activación válida instala documento y conserva
un RAF. Chrome con Umami real también controla A lenta → inválido → C y luego
libera A: C permanece activo y A no genera una vista.

### 6. Códec y trailing data

Stored/fixed/dynamic exactos, BFINAL/EOB y padding final PASS; +1 byte, varios,
segundo stream, truncados y estructuras corruptas rechazados. Corpus adicional
de 415 streams contrastado con zlib: 332 exactos admitidos con longitud de salida
coincidente, 83 corruptos/no exactos rechazados por la frontera completa.
Casos explícitos: BTYPE reservado, LEN/NLEN inválidos, Huffman sobresuscrito,
repetición 16 sin previo, repetición excesiva y EOB ausente. Lecturas acotadas
por bits, tablas limitadas a 15 bits/286+32 símbolos, repeticiones acotadas,
distancias limitadas a salida previa; cada ciclo consume bits. El parser
estructural exige consumo de todos los bytes y cuenta salida; el descompresor
nativo valida adicionalmente las tablas/stream. Algunas tablas incompletas
pueden superar el recorrido pero nunca evitan el descompresor nativo.
No se cambió v0/v1 ni se recomprime. Exactamente 2 MiB aceptados y +1 byte
rechazado en ambas versiones; bomba de compresión preservada.

### 7. Limpieza de ERROR

Modelo vacío inactivo, settings por defecto, payload nulo, página cero, tabs
retiradas, Present/preView/gestos/pinch/viewport/reloj/caches/RAF retirados;
canvas transparente real. Tests inspeccionan imgCache, tintedURL y edgeLabelPos
además del documento. CTA/Present no actúan ni emiten eventos en ERROR.
No se exige zeroization de memoria JavaScript.

### 8. Analytics y privacidad

Una vista tras primer render por activación exitosa; A/B/A cuenta tres,
mismo payload activo e inválidos no añaden evento. La carrera a C añade sólo
la vista de C. Script actual de cloud.umami.is descargado el día de QA y
ejecutado en Chrome con origen oficial simulado; peticiones del proveedor
interceptadas y resueltas localmente. Captura de requests/headers/body/referrer:
cero FLUYO_PRIVATE_MARKER_12345, payloads probados y #d=. Eventos con url /,
título Fluyo, referrer vacío, sin data/identificadores de diagramas ni pageviews
automáticos. También pasan los tres eventos Share de la suite original.
Sin telemetría enviada al proveedor; no es sólo mock del wrapper.

### 9. Viewer read-only

Shell/frontera ejecutable y globals de Chrome PASS. No state.js, factories
editoriales, editor-runtime, interaction, selection, ui, export ni autosave.
El helper SVG es puro y compartido; no introduce DOM/editor en el modelo.

### 10. Regresiones

Importar 38/38, editar 51/51; crear/editar/mover/conectar/Present, guardar,
PNG/SVG, deep link/Share/copia editable y file:// PASS. Los gates originales
permanecen y la cobertura se amplió; no se ajustaron para tolerar Q1–Q4.

### 11. Service worker

v38 fue verificada inicialmente; la corrección de asset servido obliga por
AGENTS a **v39**. Chrome verifica fixtures v37 → v38 → v39, instalación,
activación y claim efectivos, eliminación de las anteriores, helper en shell/
precache y Share SVG previamente abierto offline. Se corrigió una debilidad
del test: esperar el booleano asíncrono resuelto, no una Promise truthy de
waitForFunction. No cambia estrategia PWA. Fixtures de versiones anteriores
no equivalen a probar un perfil real instalado de producción.

### 12. Tests ejecutados

- Suite previa de 65 tests: PASS; con nueve nuevos: **74/74 PASS**.
- Seis gates qa-share: PASS; qa-share-hash-browser Chrome: Snapshot B y CTA B.
- share-browser con Umami actual: import 38/38, editing 51/51, smoke/PWA/
  file/privacy PASS, cero pageerror.
- share-post-qa-browser ampliado: SVG de UI/nativo, tabs/viewport/ERROR,
  PWA v37/v38/v39 y privacidad con carrera real PASS, cero pageerror.
- render-boundary, render-boundary-run, editor-runtime: PASS.
- node --check: 35 archivos JS/CJS/SW PASS; git diff --check PASS.
- Mutaciones Q1/Q2/Q3/Q4 en copias aisladas: **4/4 detectadas** por gates
  preservados (cada mutación produce exactamente el fallo esperado).

Comando de suite completa:
`node --test test/share.test.cjs test/viewer.test.cjs test/analytics.test.cjs test/qa-share.test.cjs test/share-post-qa.test.cjs test/share-final-qa.test.cjs`.
Chrome requiere NODE_PATH al Playwright del entorno y el archivo actual de
Umami como argumento en las dos suites share-browser/post-qa-browser.

### 13. Cambios realizados

safe-svg ampliado para output estático del exportador, SW v39, nuevo
share-final-qa.test.cjs, browser gates reforzados y documentación/handoff.
Se conserva íntegra la auditoría inicial anterior a esta sección. No se
modificaron códec ni viewer durante esta re-QA, ni schema/hosting/dependencias.
Sin commit/push y sin FLUYO-007.

### 14. Riesgos restantes

Subconjunto SVG limitado y ocho niveles; firma raster no certifica integridad
visual; navegador nativo requerido para deflate-raw; Safari/Firefox/móvil físico
no revalidados; clientes pueden truncar enlaces. Corpus no demuestra formalmente
RFC 1951. Umami remoto puede cambiar. No se añadió dependencia de hosting;
la implementación todavía debe verificarse en producción después del deploy.

### 15. Estado final recomendado

Re-QA aprobada con corrección menor aplicada. Lista para despliegue cuando se
autorice; validación de release pendiente del smoke obligatorio en
https://fluyo.space/s/#d= con assets y cabeceras desplegados. Sin defectos
abiertos de Q1–Q4 en la cobertura ejecutada. No continuar FLUYO-007.
