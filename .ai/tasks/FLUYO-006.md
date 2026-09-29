# FLUYO-006 — Share MVP sin backend

Estado: CHANGES REQUIRED — diagnóstico de bloqueo Share reportado en producción (2026-09-28)
Owner/agente actual: Codex

## Handoff de re-QA final

Veredicto: **APPROVED WITH MINOR FIXES**. Q1–Q4 revalidados mediante código,
gates conservados, adversariales y Chrome real; no quedan defectos abiertos
de estos cuatro hallazgos en los escenarios probados. El detalle final está
al final de `FLUYO-006-QA.md`; su auditoría inicial se conserva como histórico.

- **Corrección menor encontrada y aplicada:** un SVG vectorial exportado por
  la propia UI era rechazado por safe-svg (marker ausente de su lista). Se
  admiten markers/atributos estáticos, context-stroke/context-fill, textLength/
  lengthAdjust, href+xlink:href idénticos y SVG locales anidados, reconstruidos
  en cada nivel con máximo ocho niveles. Alias contradictorios, contenido
  activo y referencias externas siguen rechazados, también dentro de SVG
  anidados. Sin cambios de schema v3, transporte v0/v1 ni dependencias.
- **Archivos cambiados en esta re-QA:** `js/safe-svg.js`, `sw.js`,
  `test/share-final-qa.test.cjs` (nuevo), `test/share-post-qa-browser.cjs`,
  `test/share-browser.cjs`, README, ARCHITECTURE, DECISIONS y ambos documentos
  FLUYO-006. Caché **v39**, requerida por AGENTS tras modificar un asset servido.
- **Cobertura nueva:** A lenta → inválido → C con éxito/fallo obsoletos;
  A/B pendientes resueltos tras C; CTA atrasada; caches/viewport/página en
  ERROR; 415 streams contrastados con zlib (332 exactos admitidos y 83 corruptos/
  no exactos rechazados); tablas dynamic inválidas/repeticiones/EOB; límite
  exacto 2 MiB y +1 byte en v0/v1; SVG anidado activo/profundidad; mutaciones
  Q1/Q2/Q3/Q4 en copias temporales aisladas detectadas por gates conservados.
- **Pruebas:** 65/65 previos + 9 nuevas = **74/74 PASS**; seis gates QA PASS;
  qa-share-hash-browser PASS; importación **38/38**, edición **51/51**;
  render-boundary, render-boundary-run, editor-runtime PASS; sintaxis de 35
  JS/CJS/SW PASS; git diff --check PASS (sólo avisos CRLF preexistentes).
- **Chrome real:** SVG UI insertar/guardar/importar/píxel rojo, SVG generado
  por Fluyo insertado como imagen, export con código/icono/SVG local anidado
  normalizado y píxel rojo nativo, deep link/Share/copia/editabilidad, hash con
  tabs/página/viewport de B, ERROR limpio/recuperación, PNG/SVG/file:// PASS.
- **PWA:** fixtures v37 → v38 → v39, activación/claim efectivos y eliminación
  de caches anteriores, helper en shell/precache y Share SVG ya abierto offline
  PASS. Se corrigió la espera del test: consultar el booleano asíncrono resuelto
  desde Node; no asumir que una Promise en waitForFunction acredita activación.
  Las fixtures prueban la estrategia de upgrade, no un perfil real de producción.
- **Privacidad:** Umami actual descargado y ejecutado en Chrome con origen
  oficial simulado; requests/headers/body/referrer capturados e interceptados,
  cero marcador/payload/hash. Navegación y carrera real A lenta → inválido → C
  producen sólo una vista por activación exitosa; sin datos del documento,
  pageviews automáticos ni resultados obsoletos. Sin envío al proveedor.
- **Riesgos:** subconjunto SVG deliberado (no filtros/hojas CSS arbitrarias),
  ocho niveles como límite de validación; firma raster no garantiza integridad
  visual; Safari/Firefox/móvil físico no probados; APIs nativas y truncamiento
  de enlaces mantienen limitaciones previas. Parser estructural complementa
  al descompresor nativo, no lo sustituye ni es una prueba formal de RFC 1951.
- **Próximo paso:** desplegar estos cambios cuando se autorice, y comprobar
  `https://fluyo.space/s/#d=` con assets/cabeceras actuales y un Share SVG.
  No cerrar la validación de release antes de ese smoke post-deploy. No se
  añadió requisito de hosting. Sin commit/push ni inicio de FLUYO-007.

La sección siguiente documenta el handoff de implementación anterior a esta re-QA.

## Resolución QA

Los cuatro hallazgos de `FLUYO-006-QA.md` están corregidos. Se conservan el
informe independiente y todos sus gates; no se eliminó ni debilitó ningún caso.
La nueva semántica de analytics en navegación sigue la solicitud post-QA:
share_viewed por cada nueva activación válida, después de su primer render.

### Q1 — SVG seguro y roundtrip

1. **Causa raíz:** el normalizador sólo admitía raster aunque la UI seguía
   creando nodos con SVG local, produciendo archivos que no podía reabrir.
2. **Corrección:** `safe-svg.js`, helper puro y compartido, reconstruye SVG
   estático desde listas cerradas. Admite formas, texto, grupos, gradientes,
   referencias internas y raster embebido con firma coherente; rechaza scripts,
   handlers, foreignObject, DTD, namespaces ajenos, CSS arbitrario y URLs externas.
   Style estático permitido se convierte a atributos validados. Se validan los
   bytes/estructura, no sólo MIME/extensión. La UI valida ANTES de cargar Image
   o crear el nodo, y comunica rechazo sin guardar un documento inválido. Rechaza
   dimensiones nulas y conserva tamaños positivos al reducir imágenes estrechas.
3. **Tests:** gate original SVG, unit tests de URI histórico/base64/UTF-8,
   idempotencia/estilos/entidades/CDATA/MIME falso, deep links v0/v1 y render.
   Chrome: insertar → guardar archivo real → reimportar → imagen roja verificada
   por píxel RGBA → export PNG/SVG → Share renderizado; SVG peligroso bloqueado.
4. **Compatibilidad:** mismo schema v3/clave img y representación histórica
   `data:image/svg+xml;base64,...`. SVG estáticos admitidos vuelven a abrir.
   Remotos siguen rechazados; no se amplió a SVG activo ni recursos externos.
5. **Riesgo residual:** subconjunto estático deliberado, no parser SVG universal;
   filtros, estilos globales, metadata/atributos desconocidos y otras construcciones
   requieren simplificación/raster local. No se garantiza render de un archivo
   raster corrupto sólo por coincidir su firma. Sin dependencia nueva.

### Q2 — Navegación hashchange

1. **Causa raíz:** viewer sólo procesaba DOMContentLoaded y conservaba payload
   inicial aunque la URL cambiara sin recargar la página.
2. **Corrección:** cada nuevo payload invalida el runtime anterior y pasa por
   LOADING → loader común → primer render → READY. Una generación invalida
   cargas y callbacks tardíos. Se resetean viewport/reloj/gestos; listeners de
   viewport se instalan una sola vez y sólo queda un RAF activo. CTA comprueba
   coherencia con el fragmento actual, incluso durante una navegación en curso.
3. **Tests:** gate original real A → B y URL CTA B; unit A → B → A, mismo
   payload/parámetros irrelevantes sin evento, carga lenta A frente a B/invalid;
   Chrome atrás/adelante, A → B → Open → B editable y recuperación a C editable.
4. **Compatibilidad:** conserva `/s/#d=` y `/#d=`, códec común, demo explícita,
   read-only y ausencia de almacenamiento del creador. Analytics sigue sin props.
5. **Riesgo residual:** las APIs de navegador y la matriz móvil siguen pendientes
   de QA físico; ningún identificador/payload llega a analytics.

### Q3 — DEFLATE exacto sin trailing data

1. **Causa raíz:** el descompresor nativo podía ignorar bytes tras BFINAL/EOB.
2. **Corrección:** recorrido estructural RFC 1951 dentro de `link-codec.js`, antes
   de DecompressionStream, contando bits/salida y comprobando que el stream
   ocupa exactamente todos los bytes. Bloques stored/fixed/dynamic, códigos
   Huffman, distancias y repeticiones; se permiten bits de padding del último
   byte. La descompresión sigue siendo nativa; no hay segundo códec ni
   recompresión para comparar identidad, ni nuevo envelope/versión.
3. **Tests:** gate original trailing bytes; un byte, varios bytes, segundo stream,
   truncado, v0/v1 y documentos históricos. Siete configuraciones independientes
   de zlib y corpus binario determinista de 32 streams, incluidos bloques múltiples
   y padding. Defensa 2 MiB/bomba preservada; se rechaza antes de inflar si el
   recorrido supera el límite, además del contador de salida nativo existente.
4. **Compatibilidad:** v0/v1 y distintos encoders legítimos conservados. Sólo se
   endurecen streams incompletos, inválidos o con datos posteriores.
5. **Riesgo residual:** recorrido estructural propio pequeño, probado con corpus
   y navegador; merece revisión independiente. Navegadores sin soporte de
   deflate-raw nativo mantienen la limitación previa, no se agregó polyfill.

### Q4 — ERROR realmente inactivo

1. **Causa raíz:** se limpiaba UI/canvas sin retirar modelo/payload instalados.
2. **Corrección:** limpieza común al navegar y fallar: modelo vacío inactivo,
   settings por defecto, payload/key nulos en ERROR, imagen/labels cacheados
   retirados, presentación/preView/gestos/viewport/reloj/tabs/canvas reseteados y
   RAF cancelados. Generaciones impiden reinstalación por un decode tardío.
3. **Tests:** gate original primer render; A → invalid comprueba modelo, settings,
   payload, Present/Open, cero RAF/gestos y canvas transparente real; ERROR → C
   vuelve a READY. Fallo natural de icono durante primer render sin share_viewed.
4. **Compatibilidad:** modelo vacío equivale a ningún Share activo; no se renderiza
   ni permite interacción hasta la siguiente activación válida. Core/editor y
   schema permanecen, sin introducir factories/runtime editoriales en viewer.
5. **Riesgo residual:** no es zeroization de memoria JS, sólo invalidación y
   eliminación de referencias activas del runtime, como solicita el post-QA.

### Archivos de esta corrección

- Nuevo `js/safe-svg.js`; cambios en `model.js`, `interaction.js`, `link-codec.js`,
  `viewer.js`, shells `index.html`/`s/index.html` y SW **v37 → v38** con helper nuevo.
- Nuevos `test/share-post-qa.test.cjs` y `test/share-post-qa-browser.cjs`.
- Harness viewer: window/hashchange y RAF cancelables reales en el mock;
  secuencias render-boundary/HTML de tests incluyen el helper compartido.
  share-browser exige ahora v38; test original de rechazo sólo renombra su
  descripción para explicitar SVG malformado, manteniendo todas sus aserciones.
- README, ARCHITECTURE y D-010 reflejan SVG seguro/compatibilidad, integridad
  del códec y activaciones. Este handoff conserva el diagnóstico original abajo.

### Validación final

- `node --test test/share.test.cjs test/qa-share.test.cjs test/share-post-qa.test.cjs test/viewer.test.cjs test/analytics.test.cjs`: **65/65 PASS**.
- Gates QA preservados: **6/6 PASS** y `qa-share-hash-browser.cjs` PASS
  (`actual: Snapshot B`, `copyMatchesB: true`).
- render-boundary, render-boundary-run, editor-runtime: PASS.
- node --check JS/SW/CJS y git diff --check: PASS.
- Chrome real share-browser con Umami actual: **38/38 import**, **51/51 editing**,
  smoke crear/editar/mover/conectar/Present/Share/copia/clipboard y file:// PASS,
  viewer offline v38 PASS; requests sin marcador/hash/payload, tres eventos
  sanitizados, cero pageerror; telemetría interceptada, no enviada al proveedor.
- Chrome post-QA: SVG roundtrip/render/export/Share PASS; navegación y estado
  limpio/recuperación/CTA editable PASS; fixture de SW previa v37 (misma estrategia,
  sin helper en shell/precache) → v38 activated, eliminación de v37 y Share SVG
  offline PASS. Se espera activación, no sólo aparición del nombre de cache.
- Umami actual durante hash navigation: A/B/A producen tres activaciones vistas;
  invalid y mismo estado no agregan eventos. URL `/`, título Fluyo, referrer vacío,
  cero apariciones externas de FLUYO_PRIVATE_MARKER_12345/hash/payload/pageview.

**Estado recomendado:** implementación corregida y gates verdes, lista para
revalidación independiente de FLUYO-006. Hosting público aún requiere comprobar
la versión desplegada, cabeceras y assets antes de release. No se desplegó,
no hubo commit/push, backend, dependencias frontend ni FLUYO-007.

**Próximo paso concreto:** revalidar los cuatro fixes con los gates y el informe
preservados; después verificar `/s/` y upgrade/offline en el hosting real.

## QA independiente — diagnóstico previo (histórico)

Veredicto: **CHANGES REQUIRED**. Informe: `FLUYO-006-QA.md`.

- Bloqueantes: SVG insertado por la UI se guarda pero no se puede reimportar;
  navegar entre Shares cambiando sólo el fragmento conserva el documento y CTA
  del Share anterior.
- Otros incumplimientos: bytes adicionales de streams v1 se aceptan; ERROR tras
  primer render conserva documento y payload parcialmente instalados.
- Se repitieron 50/50 tests originales, importación 38/38, edición 51/51,
  navegador/clipboard/file/offline y privacidad con Umami actual: PASS.
- Upgrade v36 → v37 activado, eliminación de v36 y viewer offline: PASS.
- Gates nuevos: `node --test test/qa-share.test.cjs` produce 3 PASS / 3 FAIL;
  `node test/qa-share-hash-browser.cjs` falla por Snapshot A ante URL B y CTA A.
  Son regresiones abiertas y reproducibles, no fallos de infraestructura.
- Ocho mutaciones aisladas fueron detectadas; ninguna quedó en el working tree.
- Sólo se añadieron gates de QA e informe y se actualizó este estado. No se
  modificó runtime, decisiones ni SW; no hubo commit/push ni FLUYO-007.

Próximo paso: corregir los cuatro hallazgos del informe preservando documentos
históricos y privacidad; volver a ejecutar ambos gates y las suites originales.
Después desplegar y verificar la implementación actual en `/s/`: producción
responde 200 pero todavía sirve el shell anterior.

El handoff de implementación que sigue se conserva como registro histórico;
sus afirmaciones de compatibilidad/completitud quedan subordinadas a este QA.

## Objetivo y arquitectura final

```text
snapshot canónico → compression → URL fragment → viewer
serializeProject → projectFromProjectData → encodeDeepLink → /s/#d=payload
```

Todo ocurre en cliente sobre el hosting estático existente. Se extrajo el códec
original de `deeplink.js` y `share-loader.js` a `link-codec.js`, conservando v1
(deflate-raw) y v0 (UTF-8 sin compresión), ambos base64url. No hay nuevo schema;
`.fluyo.json` conserva v3 y sus claves. La entrada sigue pasando por la frontera
compartida `projectFromProjectData()`, con migración y normalización sobre copia.

## Contexto mínimo

`AGENTS.md`, `.ai/PRODUCT.md`, `.ai/ARCHITECTURE.md`, `.ai/DECISIONS.md`,
FLUYO-003/004/005; búsquedas dirigidas en deep link, loader/viewer, editor,
analytics, SW y sus tests. No se exploraron repositorios hermanos.

## Creación y UX

1. Compartir abre un diálogo nativo con identidad de Fluyo; no genera ni emite eventos.
2. Explica copia, acceso de cualquiera con el enlace, ausencia de almacenamiento
   en servidor e imposibilidad de revocar desde Fluyo.
3. Crear enlace confirma; termina texto pendiente, valida/copia y comprime el
   snapshot sin conservar referencias del documento editable.
4. `buildShareUrl(baseUrl,payload)` produce una URL de mismo origen `/s/#d=`;
   valida HTTP/HTTPS y calcula el límite sobre la URL final.
5. La URL aparece en un textarea seleccionable. `navigator.clipboard.writeText`
   confirma sólo éxito real; falta de API/rechazo mantiene URL y selecciona
   el campo con instrucciones de copia manual. Crear está bloqueado durante
   compresión y tras éxito, para no duplicar creación/evento por clic repetido.
6. Modificar el editor después no modifica los bytes del enlace anterior.

Producción: `https://fluyo.space/s/#d=<payload>`.
Local: `http://localhost:<puerto>/s/#d=<payload>`.

## Viewer y copia editable

- Presencia de `d` tiene prioridad absoluta. Vacío, duplicado, base64 no canónico,
  truncado, corrupto o documento inválido termina en ERROR; no hay fallback a demo.
- Fixture de desarrollo sólo mediante un único `?s=demo` exacto. Pathnames o
  `#s=demo` no seleccionan demo. El adapter de fixtures permanece para tests.
- Decode → descompresión acotada → parse → frontera de validación/migración/
  normalización compartida → primer render exitoso → READY → `share_viewed`.
- ERROR deshabilita Present/Open, limpia canvas/tabs y no inicia/continúa el loop.
- Preserva identidad, canvas, pan, zoom, páginas, animación y Present de FLUYO-005.
- No carga estado, fábricas mutables, autosave ni módulos del editor; no usa
  localStorage/IndexedDB/sessionStorage/cookies para obtener el documento.
- Abrir en Fluyo lleva `/s/#d=X` a `/#d=X`, usando el mismo payload validado
  sin reserializar. El editor importa copia editable con el flujo de conflictos
  de sesión existente; no conserva identidad remota ni escribe de vuelta.

## Restricciones del MVP

- **65536 caracteres (64 KiB)** para la URL final, inclusivo.
- Si excede: «Este diagrama es demasiado grande para compartir mediante enlace.
  Puedes exportarlo como archivo por ahora.» No muestra enlace ni emite creación.
- Se conserva el límite defensivo previo de **2 MiB de JSON descomprimido** del
  códec. La creación tampoco genera enlaces que su propio decoder no pueda leer.
  Ambos límites son del transporte por enlace; `.fluyo.json` no recibe límite de tamaño.
- Bajo `file://`, Compartir informa que requiere abrir Fluyo desde su versión web;
  Crear enlace deshabilitado. El builder también rechaza file. El editor funciona.
- Sin backend, API nueva, servidor Share, storage remoto, auth, IDs de shares,
  revoke, sync, expiración ni gestión de enlaces. Snapshot inmutable.
- Assets aportados por documentos: PNG/JPEG/WebP/GIF base64 embebidos; no URLs
  remotas ni SVG de documento. La regla se aplica en el normalizador compartido
  (archivo, deep link y viewer), sin política aparte de Share. Iconos SVG propios
  del catálogo permanecen. No se sube ni separa ningún asset.

## Analytics y aceptación de privacidad

- `share_created`: una vez al confirmar y completar URL válida dentro del límite;
  no al abrir/cancelar diálogo, al fallar ni al copiar.
- `share_viewed`: preservado tras primer render exitoso, una vez por carga.
- `share_opened_in_editor`: preservado en acción explícita del CTA del viewer;
  mide ese gesto, no confirmación de importación frente a un conflicto posterior.
- Los tres son eventos agregados sin propiedades, IDs, tamaño ni correlación.
- Umami: `data-auto-track=false`, exclude hash/search y before-send que reconstruye
  URL `/`, título `Fluyo`, referrer vacío, descartando campos no admitidos.
- Editor y viewer declaran `no-referrer`. No se loguea URL/hash/payload; errores
  del viewer usan mensajes constantes. CSP permite el endpoint actual
  `https://gateway.umami.is` del mismo proveedor ya existente.
- **Prueba de red PASS en Chrome real**: script actual de Umami descargado desde
  `https://cloud.umami.is/script.js` el 2026-09-28, ejecutado en navegador con
  origen oficial simulado. Documento v0 con `FLUYO_PRIVATE_MARKER_12345` en
  nombre/label. Se capturaron requests, bodies y headers en viewer y editor;
  se comprobaron los tres eventos y el request inicial al servidor HTTP local.
  No apareció marcador, su base64, payload ni `#d=`. URL/título/referrer de eventos
  fueron constantes. El script no produjo captura automática. El endpoint de
  analytics fue interceptado/resuelto localmente: **no se envió telemetría real**.

## Service worker / PWA

CACHE `fluyo-static-v36` → `fluyo-static-v37`. Precaché de los tres JS nuevos;
editor y viewer preservados, sin estrategia nueva. Instalación real v37 y viewer
con snapshot en contexto offline PASS. Cache no contiene `#d=` ni documentos Share
como recursos. No se probó actualización desde una instalación persistente v36.

## Archivos nuevos

- `.ai/tasks/FLUYO-006.md`: alcance, evidencia y handoff.
- `js/link-codec.js`: códec puro compartido extraído de implementaciones existentes.
- `js/share-url.js`: generación pura/testeable, snapshot y límite final.
- `js/editor-share.js`: confirmación, resultado, clipboard y evento de creación.
- `test/share.test.cjs`: nueve regresiones del MVP.
- `test/share-browser.cjs`: harness Chrome, flujo, privacidad, file y PWA offline.
- `test/viewer-harness.cjs`: mocks reutilizados, extraídos de tests del viewer.

## Archivos modificados

- `index.html`, `css/styles.css`: acción y diálogo con identidad existente;
  scripts clásicos y no-referrer del editor.
- `js/deeplink.js`: decoder extraído; comportamiento de importación preservado.
- `js/model.js`: assets autocontenidos en la frontera común.
- `js/share-loader.js`, `js/viewer.js`, `s/index.html`: fragmento, prioridad, payload
  reutilizable, carga de códec y CSP del proveedor real.
- `js/analytics.js`: share_created, captura automática desactivada, filtro preservado.
- `sw.js`: v37 y assets necesarios.
- `test/analytics.test.cjs`, `test/viewer.test.cjs`, `test/render-boundary.cjs`,
  `test/documento-entrante.html`: regresiones/orden de scripts actualizado.
- `README.md`, `privacidad/index.html`: flujo, límites y eventos públicos.
- `.ai/ARCHITECTURE.md`: mapa del MVP.
- `.ai/DECISIONS.md`: D-010 y estado diferido de D-008.

## Decisiones y futuro

D-010 documenta el MVP autocontenido y difiere persistencia de D-008. FLUYO-003
se conserva sin borrar su diseño; la solución persistente allí descrita sólo se
reconsidera si las métricas agregadas muestran uso real de Share. No se registra
estrategia comercial privada. No se continuó con FLUYO-007.

## Tests y resultados

- `node --test test/share.test.cjs test/viewer.test.cjs test/analytics.test.cjs`:
  **50/50 PASS** (Share 9, viewer 28, analytics 13).
- `node test/render-boundary.cjs`: PASS (secuencia clásica editor/core, guardas file).
- `node test/render-boundary-run.cjs`: PASS (renderer sin runtime/persistencia editor).
- `node test/editor-runtime.cjs`: PASS (frame, RAF y presentación).
- `node --check` para `js/*.js`, `sw.js`, `test/*.cjs`: PASS.
- `git diff --check`: PASS.
- Chrome real headless: `documento-entrante.html` **38/38**;
  `editor-inline.html` **51/51**; cero excepciones `pageerror`.
- Smoke de crear/copiar, contexto limpio, A→B inmutable, pan, zoom, reloj/animación,
  tabs, Present, copia editable modificada sin afectar viewer, inválido/truncado/
  demo/prioridad, exceso de tamaño, `file://` y offline: PASS.
- Capturas editor/modal/viewer inspeccionadas visualmente; identidad preservada.
- Aceptación de privacidad de red: PASS con proveedor real e interceptado.

### Repetir navegador (sólo herramientas de tests)

```powershell
$env:NODE_PATH='<node_modules del runtime con Playwright>'
$auditScript = Join-Path $env:TEMP 'fluyo-umami-script.js'
Invoke-WebRequest https://cloud.umami.is/script.js -OutFile $auditScript
node test/share-browser.cjs $auditScript
```

Usa Chrome instalado (`FLUYO_BROWSER=edge` permite Edge). El servidor efímero y
Playwright pertenecen exclusivamente al test; no se añaden dependencias al frontend,
servidores de producto ni infraestructura de despliegue.

## Riesgos y límites de cobertura

- Medios de mensajería/navegadores pueden truncar enlaces aun dentro de 64 KiB;
  se muestra error terminal y se puede usar archivo. No hay revoke ni cifrado.
- Compatibilidad depende de APIs existentes de compresión; v0 disponible al crear
  sin CompressionStream. Navegadores sin descompresión no pueden abrir v1.
- Documentos históricos con imágenes externas o SVG aportado ahora se rechazan
  también al importar; se documenta por la garantía compartida de privacidad.
- QA visual físico móvil/táctil y matriz Safari/Firefox no ejecutados.
- Se comprobó instalación/offline v37, no upgrade de caché antigua en un perfil real.
- No se desplegó: `/s/` debe seguir sirviendo su directorio estático en hosting;
  `frame-ancestors`/X-Robots-Tag por HTTP dependen de configuración existente y
  no se crean servicios para fijarlos. No se declara verificado el hosting público.
- El script remoto de Umami puede cambiar; la prueba es reproducible descargando
  su versión actual. La política pública inglesa conserva su texto anterior.

## Handoff / próximo paso

Recomendación: **listo para QA independiente de FLUYO-006** sobre este working tree.
Repetir pruebas y confirmar matriz de dispositivos/hosting antes de publicación.
Implementación y validaciones disponibles completadas; no se hizo commit, push,
backend, API nueva ni infraestructura, y no se inició FLUYO-007.
