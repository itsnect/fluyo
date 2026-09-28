# FLUYO-003 — Share Foundation Architecture

Estado: DONE (diseño aprobado por revisión humana el 2026-09-28; implementación dividida en FLUYO-004/005/006)
Owner/agente actual: — (diseño: Codex; revisión arquitectónica y actualización tras aprobación: Claude)

> Esta tarea es la **fuente de verdad** de su trabajo: cualquier agente debe poder continuar leyendo solo esta tarea + `AGENTS.md`.
>
> **Repo público**: este archivo puede terminar publicado en GitHub. Contiene únicamente arquitectura técnica pública; no incluye información confidencial, métricas privadas, credenciales, estrategia comercial ni roadmap privado.

## Objetivo

Diseñar la arquitectura mínima para publicar un documento Fluyo mediante una URL no enumerable (`https://fluyo.space/s/<id>`) y visualizarlo como una experiencia interactiva read-only, sin implementar todavía Share ni añadir infraestructura o dependencias.

## Por qué

Compartir debe conservar el renderizado, la navegación y la presentación propias de Fluyo, manteniendo a la vez la simplicidad client-side del core y la retrocompatibilidad del formato `.fluyo.json`.

## Alcance

### Incluye

- Modelo e identidad del share.
- Persistencia hospedada y API mínima de creación/lectura.
- Separación entre viewer read-only y editor reutilizando modelo y renderer.
- Flujo `Open in Fluyo` hacia una copia local editable.
- Seguridad, abuso, privacidad y analytics mínimos de v1.
- Frontera entre core OSS y servicio hospedado.
- Alternativas, tradeoffs y decisiones pendientes de aprobación.

### No incluye

- Implementación de código productivo, backend o dependencias.
- Autenticación, cuentas, equipos, comentarios, colaboración realtime, permisos avanzados, shares privados, billing, historial, edición remota o sincronización.
- AI o Explain.

## Contexto necesario

Leer (solo esto antes de empezar):
- `AGENTS.md`
- Esta tarea.
- Para implementar: `.ai/ARCHITECTURE.md`, `.ai/DECISIONS.md`, `.ai/tasks/FLUYO-002.md` y búsquedas dirigidas en los archivos señalados en «Arquitectura actual relevante».

No es necesario leer:
- `.ai/PRODUCT.md`: el objetivo público relevante ya está acotado por esta tarea y `AGENTS.md`.
- Otras tareas o repositorios hermanos.
- Páginas estáticas no mencionadas en el plan de implementación.

## Criterios de aceptación

- [x] Se comparan 2–3 alternativas reales para las decisiones importantes y se recomienda una.
- [x] Se define qué se persiste, el identificador, la infraestructura y la API mínima.
- [x] Se diseña un viewer inequívocamente read-only sin duplicar modelo ni renderer.
- [x] Se define `Open in Fluyo` como importación de una copia local editable.
- [x] Se cubren seguridad, abuso, privacidad y los tres eventos reservados en FLUYO-002.
- [x] Se distingue el core OSS del servicio hospedado.
- [x] Se identifican las decisiones que necesitan aprobación humana y la siguiente tarea de implementación.
- [x] No se modifica código productivo, no se añade backend ni dependencias.

## Resumen de la recomendación

> Diseño revisado y aprobado por decisión humana el 2026-09-28. Las decisiones antes listadas como pendientes de aprobación (§13) quedan resueltas en esta versión de la tarea; el detalle de cada una vive en su sección correspondiente y en `.ai/DECISIONS.md` D-008.

Un share v1 es una **instantánea inmutable del documento `.fluyo.json` completo y canónico**, ya validado y normalizado por el mismo normalizador que usan archivo y deep link, que el editor produce con `serializeProject()`. Se guarda como un blob JSON bajo un identificador aleatorio de 128 bits no enumerable — una *capability URL* pública, no un mecanismo de autenticación fuerte. Un endpoint serverless/edge de mismo origen valida y crea el objeto y devuelve, una sola vez, un `deleteToken` de alta entropía que permite al creador retirar su propio share; otro endpoint lo recupera. No existen endpoints para listar o actualizar shares; sí existe `DELETE`, autorizado únicamente por el `deleteToken`.

`/s/<id>` sirve un shell de viewer independiente, servido con `noindex, nofollow` y `Referrer-Policy` explícita para no ampliar la descubribilidad del enlace más allá de quien lo recibe. Ese shell comparte el contrato de documento, geometría y renderer con el editor mediante una frontera explícita de estado (`FLUYO-004`), pero no carga módulos de selección, mutación, exportación ni autoguardado. Su único estado mutable es de presentación: página activa, zoom, pan, pausa y fullscreen. `Open in Fluyo` abre el editor con una referencia al share, vuelve a validarlo y lo instala como una copia local sin conservar ningún vínculo editable con el objeto remoto.

No hay expiración automática en v1 ni promesa de almacenamiento permanente como SLA: los shares simplemente no tienen TTL hasta que se decida lo contrario. Embeds de terceros quedan fuera de v1.

```text
editor                         servicio hospedado                      viewer
serializeProject()            POST /api/shares                        /s/<id>  (noindex, nofollow,
       │                      valida + normaliza + crea objeto inmutable        Referrer-Policy)
       │                      genera id + deleteToken (hash guardado)      │
       └──── JSON v3 ───────► shares/<id>.json ◄──── GET /api/shares/:id ─┘
                                       │                                   │
                              DELETE /api/shares/:id                       │
                              (autorizado por deleteToken,           formato + geometría + renderer
                               nunca en query string)                     compartidos (FLUYO-004)
                                                                            │
                                                   Open in Fluyo → /#s=<id>
                                                                            │
                                               fetch + validar + copia local editable
```

## Arquitectura actual relevante para Share

- Fluyo es hoy un sitio estático, sin router, backend, build ni dependencias. La aplicación también abre desde `file://`.
- `serializeProject()` en `js/state.js` produce `{version:3, app:"fluyo", doc, settings}`. Ese mismo objeto se usa para guardar archivo y autosave.
- `documentFromProjectData()` es el único normalizador/importador compartido: acepta el modelo actual y uno legado, rellena defaults y comprueba que páginas, nodos y flechas sean arrays. No aplica todavía límites estructurales, de cadenas, números o imágenes suficientes para contenido remoto público.
- `js/deeplink.js` ya trata entrada no confiable, limita el JSON descomprimido a 2 MiB y clasifica fallos, pero transporta el documento en el fragmento y no lo persiste. Es una referencia útil, no el transporte de Share.
- `js/render.js` contiene el renderer Canvas y la animación. `js/geometry.js` contiene geometría compartible, pero ambos consumen globals del editor.
- El modo presentación actual en `js/ui.js` y `js/interaction.js` conserva render, animaciones, páginas, zoom y pan, y bloquea gestos de edición mediante `presenting`. Esto prueba la experiencia, pero no es una frontera suficiente para un viewer público porque los módulos mutables siguen cargados.
- Las páginas se renderizan con `textContent` y los labels del documento se dibujan en Canvas; no hace falta renderizar HTML aportado por el documento.
- Las imágenes pegadas se serializan en `node.img` como data URL. Un JSON importado puede actualmente colocar otros valores en ese campo porque el normalizador no restringe esquema o protocolo.
- `js/analytics.js` mezcla el transporte genérico de telemetría con estado específico del editor. Un viewer nuevo no debe emitir `editor_opened` ni depender de globals de edición.
- FLUYO-002 reservó `share_created`, `share_viewed` y `share_opened_in_editor`, sin IDs, URLs ni propiedades derivadas del contenido.
- D-003 establece que `.fluyo.json` es un contrato público retrocompatible. D-004/D-007 prohíben enviar contenido mediante analytics. Share exige actualizar la promesa pública: el contenido sólo sale del navegador cuando el usuario elige explícitamente publicarlo.

## 1. Modelo de Share

### Alternativas

1. **Documento `.fluyo.json` completo, como instantánea inmutable — recomendada.**
   - Conserva exactamente el contrato portable, todas las páginas, settings, animaciones e imágenes admitidas.
   - El mismo parser/migrador sirve para archivo, deeplink, viewer y `Open in Fluyo`.
   - No aparece un segundo esquema que pueda divergir del editor.
   - El share es una instantánea por su semántica y su inmutabilidad, no por tener otro formato.
2. **Representación derivada para render.**
   - Puede quitar campos de edición o precalcular geometría.
   - Duplica reglas de defaults/render, dificulta importar una copia editable y envejece mal cuando cambia el renderer. Se descarta.
3. **Guardar documento canónico más snapshot derivado.**
   - Podría optimizar lectura y preservar importación.
   - Duplica almacenamiento, invalidación y compatibilidad sin una necesidad medida en v1. Se descarta.

### Contrato recomendado

- El cliente crea un snapshot con el objeto completo devuelto por `serializeProject()` en la versión actual.
- La API valida el snapshot y lo normaliza con el mismo validador/normalizador que usan archivo y deep link (una sola semántica de validación/normalización, sin forks independientes entre cliente y servicio); no lo transforma a un formato de viewer ni elimina claves. **Lo que se persiste en `shares/<id>.json` es la representación canónica ya normalizada** (defaults rellenados, `nextId` corregido si hace falta), no los bytes JSON crudos recibidos en el `POST`. El objeto persistido sigue siendo un `.fluyo.json` válido y estable frente a cambios futuros del normalizador de cliente.
- Cada `POST` crea un recurso nuevo. Volver a compartir el documento produce otro ID; no hay overwrite ni deduplicación visible.
- El documento remoto es inmutable. En v1 no existen `PUT`, `PATCH` ni un botón que actualice un share. Sí existe `DELETE`, autorizado por `deleteToken` (ver §3 y §4) — no es una actualización, es retirada total.
- Metadatos operativos mínimos (`createdAt`, tamaño, estado de moderación, hash del `deleteToken`) pueden vivir como metadata del objeto o en el proveedor, fuera del JSON devuelto al cliente. No forman parte del documento ni del formato público.
- El cliente vuelve a validar en lectura. La validación del servidor protege almacenamiento/abuso; la del cliente protege el renderer y la compatibilidad ante respuestas corruptas o cachés antiguas.

### Compatibilidad

- Crear Share sólo envía la versión canónica actual que ya serializa el editor; un archivo antiguo abierto y luego compartido queda migrado al guardarlo/publicarlo.
- El viewer debe aceptar las mismas versiones históricas que el importador, por medio del mismo normalizador.
- Una versión futura desconocida se rechaza con `unsupported_version`; no se intenta renderizar parcialmente.
- No se cambia `version:3` ni el significado de ninguna clave como parte de esta tarea.

## 2. Identidad del Share

### Alternativas

1. **16 bytes aleatorios codificados en base64url, 22 caracteres — recomendada.** URL corta, 128 bits de entropía y APIs nativas (`crypto.getRandomValues` o CSPRNG del runtime).
2. **UUID v4.** Entropía suficiente y soporte ubicuo, pero 36 caracteres y guiones sin aportar semántica útil.
3. **ID incremental/tiempo + aleatoriedad corta.** Más fácil de ordenar, pero filtra volumen/fecha y aumenta el riesgo de enumeración. Se descarta.

### Reglas

- Regex pública: `^[A-Za-z0-9_-]{22}$`.
- El servidor genera el ID; no acepta uno elegido por el cliente.
- La escritura se hace con condición de «crear sólo si no existe». Ante la colisión, se genera otro ID y se reintenta un número pequeño y acotado de veces.
- 128 bits hacen impracticable enumerar y despreciable la colisión accidental para la escala esperable, pero el ID **no es autenticación**: es una *capability URL* pública — cualquiera que tenga el enlace puede acceder, por eso `/s/<id>` se sirve sin indexar (ver §5, §9).
- El ID nunca se envía en analytics, logs de aplicación de alto nivel ni mensajes de error. El servidor HTTP puede necesitar la ruta para servirla; los logs deben aplicar redacción/retención mínima.
- El `deleteToken` (§3) es una identidad **separada** del ID público: alta entropía igual o mayor, generado junto al ID pero con un propósito distinto (autorizar retirada, no localizar el recurso). Nunca se deriva del ID ni viceversa.

## 3. Persistencia

### Alternativas

1. **Object storage gestionado + función serverless/edge — recomendada.** Encaja con blobs JSON inmutables, no exige esquema ni servidor residente y puede usar escritura condicional y caché HTTP.
2. **KV gestionado + función.** Muy simple y rápido para lectura, pero muchos KV tienen límites de valor menores o consistencia eventual y acoplan más la solución a un proveedor. Es aceptable sólo si el límite real soporta holgadamente el payload definido.
3. **Base de datos/servidor propio.** Facilita consultas y lifecycle complejos que v1 no necesita; añade migraciones y operación. Se descarta.

### Diseño mínimo

La arquitectura de persistencia tiene tres piezas conceptuales explícitas, no dos: **función/edge + object storage + mecanismo de rate limiting/contador**. Las dos primeras son suficientes para el contenido de los shares; la tercera es necesaria para el `POST` público sin cuentas y no debe quedar implícita dentro de "la función".

- Una función de creación recibe JSON, aplica límites/validación, normaliza el documento (§1), genera el ID y un `deleteToken` aleatorio de alta entropía, y escribe `shares/<id>.json` de forma atómica junto con el **hash** del `deleteToken` (nunca el token en claro) como metadata del objeto. Devuelve `id` + `deleteToken` una sola vez; el token no se puede recuperar después.
- Una función de lectura valida la forma del ID y recupera el objeto. No hay índice ni operación de listado.
- Una función de borrado recibe el ID y el `deleteToken` (por cabecera/credencial, nunca en query string), compara su hash contra el guardado y, si coincide, retira el objeto de forma permanente. No hay recuperación si el token se pierde.
- El objeto se marca `application/json; charset=utf-8`, con ETag y una política de caché corta/revalidable al principio (por ejemplo `public, max-age=300`) para que una retirada por `DELETE` o por abuso tenga efecto razonable. Tras validar el flujo de retirada se puede ampliar.
- El storage no se expone directamente: el endpoint controla cabeceras, errores, límites y evita revelar nombres internos del bucket.
- El mecanismo de rate limiting/contador (tercera pieza) puede ser un primitivo del propio proveedor edge o un KV/contador ligero; su elección concreta se decide en `FLUYO-006` junto con el proveedor de storage. No se introduce una base de datos de contenido solo para resolver esto.
- El servicio necesita además una vía operativa fuera de la API pública para retirar un objeto abusivo (independiente del `deleteToken`, que es del creador). No implica permisos de usuario ni UI de borrado.
- No hace falta una base de datos para el contenido de los shares en v1. Si el proveedor no permite metadata/retirada suficiente sin índice, se puede añadir un registro mínimo posteriormente, no anticiparlo ahora.
- Retención: no hay expiración automática (TTL) en v1. Esto no es una promesa de almacenamiento permanente ni un SLA — es, simplemente, la ausencia de un mecanismo de borrado por tiempo hasta que se decida añadirlo.

## 4. API mínima

API de mismo origen; JSON solamente. Los códigos de error son estables y de baja cardinalidad. Los mensajes humanos se resuelven en el cliente.

### `POST /api/shares`

Entrada:

```http
Content-Type: application/json

{"version":3,"app":"fluyo","doc":{...},"settings":{...}}
```

- El body es exactamente el documento canónico, sin wrapper adicional.
- Requerir HTTPS, `Content-Type: application/json` y un `Origin` permitido para peticiones de navegador. No habilitar CORS abierto para creación.
- Aplicar el límite al body ya descomprimido; no aceptar content-encoding arbitrario en v1.

Éxito:

```http
HTTP/1.1 201 Created
Location: /s/f3JzV4bXk2L8qP0mR7nWcA
Content-Type: application/json

{"id":"f3JzV4bXk2L8qP0mR7nWcA",
 "url":"https://fluyo.space/s/f3JzV4bXk2L8qP0mR7nWcA",
 "deleteToken":"…alta entropía, opaco…"}
```

El éxito se devuelve sólo después de confirmar la escritura durable. No se devuelve de nuevo el documento. `deleteToken` se entrega **una sola vez**, en esta respuesta; el servidor no lo persiste en claro (solo su hash) y no existe endpoint para recuperarlo si el cliente lo pierde. El cliente puede conservar `id` + `deleteToken` localmente (p. ej. `localStorage`) para ofrecer borrado posterior desde el editor.

Errores relevantes:

- `400 invalid_json` — JSON ilegible.
- `415 unsupported_media_type` — body no JSON.
- `422 invalid_document` — estructura o valores inválidos.
- `422 unsupported_version` — versión futura/desconocida.
- `413 payload_too_large` — supera límites.
- `429 rate_limited` — incluye `Retry-After`.
- `503 temporarily_unavailable` — no se confirmó almacenamiento.

### `GET /api/shares/:id`

- `200` devuelve exactamente el `.fluyo.json` persistido (ya normalizado, §1), más `ETag` y caché revalidable.
- `304` cuando corresponde a `If-None-Match`.
- `400 invalid_id` para sintaxis imposible; `404 not_found` tanto para inexistente como retirado (por `DELETE` o por abuso) — misma respuesta para ambos casos, para no confirmar si un ID existió alguna vez; `429` para abuso; `503` para fallo temporal.
- No hay `GET /api/shares`, `PUT` ni `PATCH` públicos.
- El endpoint puede servir con `Access-Control-Allow-Origin` sólo al origen oficial o sin CORS; el viewer y editor usan mismo origen. El core OSS no depende de que el servicio oficial habilite acceso cross-origin.

### `DELETE /api/shares/:id`

- Autorizado únicamente por el `deleteToken` recibido en la creación, enviado como credencial/cabecera (p. ej. `Authorization: Bearer <deleteToken>`) — **nunca en query string** ni en el body de otra petición, para no quedar en logs de acceso ni en historial de navegación.
- El servidor compara el hash del token recibido contra el hash almacenado; nunca compara ni registra el token en claro.
- Éxito: `204 No Content`. El objeto se retira de forma permanente; una lectura posterior devuelve `404 not_found`, indistinguible de un ID que nunca existió.
- Errores: `400 invalid_id`; `401 invalid_token` o `403` (token ausente o incorrecto — código exacto a definir en `FLUYO-006`, pero sin revelar si el ID existe cuando el token es inválido); `404 not_found` si el share ya no existe; `429` para abuso.
- No hay recuperación si el `deleteToken` se pierde: el único camino que queda es el canal operativo de retirada por abuso (fuera de la API pública), que no está pensado para uso rutinario del creador.

Formato uniforme de error:

```json
{"error":{"code":"invalid_document"}}
```

No incluir detalles del documento, stack traces ni ID en el body.

## 5. Viewer read-only

### Alternativas

1. **Shell `/s/` independiente con core compartido — recomendada.** No carga mutaciones y mantiene una sola implementación de documento/geometría/render.
2. **Abrir el editor completo con `viewerMode=true` y esconder controles.** Menos archivos al principio, pero CSS o un guard olvidado dejan mutaciones activas; también arrastra autosave, undo, paste, export y atajos. Se descarta como frontera principal.
3. **Renderer/viewer separado.** Aísla bien, pero duplica el motor y diverge en animaciones, geometría y compatibilidad. Se descarta.

### Separación recomendada

La implementación debe extraer fronteras, no reescribir el producto:

- **Documento compartido:** parser, migraciones, validación acotada y serialización canónica, hoy mezclados en `js/state.js`.
- **Canvas compartido:** geometría, layout, carga segura de assets y renderer/animación, hoy en `js/geometry.js` y `js/render.js` con algunas dependencias globales del editor.
- **Editor:** estado mutable, selection, undo/redo, interacción de edición, paneles, export y autosave.
- **Viewer:** loader remoto, estado efímero de vista y controles de navegación/presentación.

Se puede conservar el modelo de scripts clásicos y apertura `file://` del editor. Los archivos compartidos se cargan en orden desde ambos HTML; no hace falta introducir módulos ES, build ni framework.

### Garantías read-only

- `/s/<id>` se resuelve mediante rewrite del hosting a un HTML estático de viewer; el cliente obtiene el ID desde `location.pathname`.
- El viewer **no carga** `selection.js`, los handlers mutables de `interaction.js`, `ui.js` de editor ni `export.js`.
- El documento validado se mantiene como snapshot de sólo lectura. Página activa, zoom, pan, pausa, tiempo de animación y fullscreen viven en un objeto de estado de vista separado y nunca se serializan sobre el snapshot.
- El renderer recibe documento/página y opciones de superficie; no debe depender de selección, textarea o DOM del editor para dibujar. Puede conservar el mismo Canvas 2D y reloj de animación.
- Pan: arrastre, rueda y gesto táctil; zoom: `Ctrl`/pinch/controles accesibles. Ningún gesto hace hit-testing editable.
- Navegación: tabs o controles read-only creados con `textContent`; no existe añadir, cerrar ni renombrar página.
- Presentación reutiliza las transiciones y reglas actuales (fit, build reiniciado por página, fullscreen opcional) con controles del viewer.
- `Made with Fluyo` y `Open in Fluyo` viven en un chrome de viewer separado del canvas y siguen accesibles por teclado.
- Ante loading/error no se inicializa el renderer. `404`, documento inválido, versión no soportada y temporalmente no disponible tienen estados diferenciados sin revelar detalles internos.
- Aunque alguien modifique el objeto en DevTools, no existe endpoint de actualización: no puede persistir el cambio sobre el share original.
- **Discoverability (decidido, ver §9):** `/s/<id>` incluye `<meta name="robots" content="noindex, nofollow">` en el HTML del shell desde el primer commit (`FLUYO-005`), sin esperar al backend; cuando exista servicio hospedado (`FLUYO-006`), la respuesta añade además `X-Robots-Tag: noindex, nofollow` a nivel HTTP. El viewer fija una `Referrer-Policy` explícita (p. ej. `strict-origin-when-cross-origin` o más estricta) en vez de depender del default del navegador, para no dejar la ruta `/s/<id>` expuesta en el `Referer` de peticiones a terceros (analytics, CDN). Esto reduce la descubribilidad del enlace; no lo convierte en secreto — la propia capability URL sigue siendo el único control de acceso (§2, §9).

### Analytics en el viewer

Antes de crear el shell conviene separar en `analytics.js` el transporte/proveedor genérico de la instrumentación del editor. El viewer carga el tracker con una superficie explícita y no ejecuta snapshots de edición ni `editor_opened`.

## 6. Flujo end-to-end de `Share`

```text
1. Usuario pulsa Share en el editor.
2. Se muestra confirmación inequívoca: «cualquiera con el enlace puede acceder».
3. El editor termina cualquier edición de texto pendiente y obtiene serializeProject().
4. La validación compartida comprueba versión, estructura, límites e imágenes.
5. POST /api/shares envía el snapshot sólo tras el gesto/confirmación.
6. El servicio valida de nuevo, genera ID CSPRNG y crea el objeto inmutable.
7. Tras escritura confirmada responde 201 {id,url,deleteToken}; entonces se dispara share_created.
8. La UI muestra/copia https://fluyo.space/s/<id> y ofrece guardar id+deleteToken localmente (p. ej. localStorage) para poder retirar el share más adelante; el token no vuelve a mostrarse después de esta pantalla.
9. El receptor abre /s/<id>; el shell hace GET /api/shares/:id.
10. El cliente valida, normaliza e instala el snapshot read-only; tras primer render útil dispara share_viewed.
11. Pan, zoom, páginas, animación y presentación sólo cambian estado local de vista.
12. Open in Fluyo navega a /#s=<id>; el editor recupera el mismo snapshot y lo aplica como copia local.
```

Si el `POST` falla o la copia de URL falla, no se afirma que el share fue creado/copied. El recurso puede haber sido creado aunque la respuesta se pierda; sin cuentas no hay forma segura de recuperarlo. La implementación puede usar un token de idempotencia aleatorio por intento si el runtime lo facilita, pero no se recomienda añadir un sistema de idempotencia persistente antes de observar que el problema sea real.

## 7. `Open in Fluyo`

### Alternativas

1. **Referencia por fragmento `/#s=<id>` y fetch desde el editor — recomendada.** El fragmento no llega en la petición inicial ni en referrer; evita volver a incrustar 2 MiB y reutiliza la API.
2. **Reutilizar `#d=` con el documento completo.** Funciona offline y ya existe, pero vuelve a imponer límites de longitud y duplica el payload que ya está almacenado. Se descarta para Share.
3. **Pasar el documento por `sessionStorage`/`localStorage`.** Evita otro GET, pero falla entre pestañas, mezcla el share con persistencia local y complica limpieza/conflictos. Se descarta.

### Flujo recomendado

- El CTA apunta a `https://fluyo.space/#s=<id>`; no incluye documento ni parámetros de edición.
- Un loader de share en el editor reconoce sólo IDs con la regex cerrada, hace `GET`, aplica la misma validación/normalización y crea un deep clone local.
- Antes de aplicar, elimina conceptualmente cualquier identidad remota. No se persiste `shareId` dentro del `.fluyo.json`, el autosave o analytics.
- Si existe autosave, reutiliza el mecanismo de documento entrante para no pisar trabajo, pero con opciones ajustadas a la semántica: «Abrir una copia» o «Seguir con mi trabajo». No se recomienda «Añadir como páginas» en este flujo v1: hoy descarta tema/settings del documento entrante y puede cambiar su apariencia, así que no representa fielmente «continuar sobre una copia».
- Al elegir abrir, se usa la misma ruta de `applyProjectData()`/normalización que un archivo, se limpian undo/redo, se centra/ajusta la vista y se habilita autosave local.
- Tras aplicación exitosa se limpia `#s=` con `history.replaceState` para que recargar no vuelva a importar ni deje la capability en historial/referrer posterior.
- Sólo entonces se dispara `share_opened_in_editor`. Cancelar, conservar el documento actual, 404 o validación fallida no cuentan.
- No se dispara además `file_imported`: Share tiene un evento propio y no debe duplicar semánticas.
- Guardar o volver a compartir crea un archivo local u otro share; nunca actualiza el recurso original.

## 8. Seguridad y abuso mínimo

### Validación compartida y doble

`documentFromProjectData()` debe evolucionar hacia dos fases reutilizables:

1. validar límites y tipos de entrada no confiable sin mutarla;
2. migrar/normalizar una copia para el runtime.

Servidor y cliente aplican el mismo contrato conceptual; si el backend no comparte lenguaje/runtime, sus tests deben usar fixtures comunes válidos e inválidos.

Límites iniciales recomendados (ajustables como configuración del servicio, no del formato `.fluyo.json` local):

- Body JSON UTF-8: **2 MiB máximo**, alineado con el límite ya usado por deeplink.
- Máximo **50 páginas**, **5.000 nodos + flechas** totales y **20.000 waypoints** totales.
- Texto individual: **10.000 caracteres**; nombres de página: **200 caracteres**.
- Todos los números deben ser finitos y estar dentro de rangos seguros de canvas; rechazar `NaN`/infinito implícitos, dimensiones negativas y escalas extremas.
- IDs enteros y únicos por página; referencias `from`/`to` deben apuntar a nodos de esa página.
- `shape`, `icon`, `anim`, fuentes, lados, rutas y enums se validan contra listas cerradas compatibles con la versión.
- Colores sólo en los formatos que el core admite; nunca insertar valores del documento como HTML/CSS sin validación.
- `nextId` se normaliza al menos a `max(id)+1` si un documento antiguo válido lo necesita; no confiar en él para seguridad.

### Imágenes/data URLs

- En v1, `node.img` compartido admite sólo data URLs base64 de raster en lista cerrada: `image/png`, `image/jpeg`, `image/webp` y `image/gif`.
- Rechazar `http:`, `https:`, `file:`, `blob:`, `javascript:`, `data:text/html` y `image/svg+xml`. Así un viewer no hace requests a terceros ni interpreta SVG activo/controlado por el documento.
- El tamaño codificado cuenta dentro de 2 MiB y los bytes decodificados agregados deben quedar bajo un límite menor configurable (recomendación inicial: 1,5 MiB).
- El cliente de creación debe explicar qué imagen impide compartir; no convertir o eliminar silenciosamente contenido.
- Los iconos y animaciones de catálogo son claves cerradas resueltas a assets propios, no URLs aportadas por el documento.

### XSS e inyección

- Labels, nombres y mensajes se dibujan en Canvas o se asignan con `textContent`; nunca mediante `innerHTML`.
- El viewer debe llevar CSP restrictiva, al menos: scripts/styles/assets propios más el proveedor de analytics ya autorizado; `img-src 'self' data: blob:`; `connect-src` limitado a API y analytics; `object-src 'none'`; `base-uri 'none'`; `frame-ancestors 'self'` (decidido: sin embeds de terceros en v1, ver §9/§11). Añadir `Referrer-Policy` explícita a nivel de página (no depender del default del navegador).
- Mantener escapado del exportador SVG, aunque el viewer no ofrezca exportación.
- No interpolar IDs en rutas de storage sin validar regex exacta.

### Delete token

- El `deleteToken` se genera con el mismo CSPRNG que el ID público, pero es una entropía/valor independiente (§2).
- El servidor **nunca persiste el token en claro**: guarda solo un hash (p. ej. SHA-256) como metadata del objeto o del registro asociado. Un volcado del storage no expone tokens utilizables.
- El token no forma parte de `.fluyo.json`, no aparece en la URL, no se registra en logs de acceso de alto nivel y no se envía a analytics.
- `DELETE` compara hashes, no valores en claro, y responde de forma uniforme a ID inexistente/token inválido en la medida de lo posible, para no ayudar a distinguir "existe pero el token es incorrecto" de "no existe".

### Rate limiting: tres piezas, no dos

La arquitectura de abuso descansa en **función/edge + object storage + mecanismo de rate limiting/contador** como tres componentes conceptuales explícitos (ver §3). El tercero no es opcional ni se puede dar por incluido en "la función": sin un contador compartido y persistente entre invocaciones (aunque sea un primitivo del proveedor edge), el token bucket por IP no tiene dónde vivir. Elegir ese mecanismo es parte de la decisión de proveedor en `FLUYO-006`, junto con el storage — no justifica introducir una base de datos de propósito general para el contenido de los shares.

### Abuso operativo

- Rate limit de creación en edge con token bucket. Punto de partida: **5 creaciones/minuto por IP, burst 10**, y un límite diario razonable configurable. Responder `429` + `Retry-After`.
- Rate limit de lectura mucho más permisivo y caché/ETag; no penalizar una vista legítima viral con un límite por share demasiado bajo.
- Límite de body antes de parsear, timeout corto, validación lineal y prohibición de compresión arbitraria evitan trabajo desproporcionado.
- No ofrecer listado/búsqueda; los IDs aleatorios reducen enumeración, no sustituyen moderación.
- Mantener una vía operativa de retirada y bloqueo de creación abusiva. No hace falta construir panel, cuentas ni permisos en v1.
- Registrar sólo datos operativos mínimos y con retención acotada; nunca loguear bodies. Redactar el ID cuando el proveedor lo permita.

## 9. Privacidad

**Decidido:** Share es una **excepción explícita y consentida** al principio local-only de Fluyo (D-004), no una reinterpretación de esa promesa. Solo aplica al gesto deliberado de publicar.

- Antes del `POST`, la UI debe mostrar de forma clara e inequívoca: **«Cualquiera con el enlace puede acceder a este diagrama.»** No usar lenguaje de «privado» o «secreto». El usuario debe confirmar explícitamente la publicación (un clic en "Compartir" tras ver este texto no es, por sí solo, confirmación suficiente si el texto no es visible en el mismo paso).
- El enlace es una ***capability URL***: el ID de 128 bits no enumerable es el único control de acceso, no una credencial de autenticación. No debe describirse como "secreto" (implica que el usuario controla su revocación) ni tratarse como si `/s/<id>` fuera privado por diseño — es un recurso público no indexado, accesible por cualquiera que obtenga el enlace por cualquier vía (reenvío, historial, proxies, capturas de pantalla).
- **Discoverability:** `/s/<id>` se sirve con `noindex, nofollow` (meta robots, y `X-Robots-Tag` HTTP cuando exista backend — ver §5) y una `Referrer-Policy` explícita, para no ampliar la exposición del enlace más allá de quien lo recibió directamente. Esto reduce el riesgo de que un crawler indexe un enlace pegado en un sitio público; no sustituye la naturaleza de capability URL del propio ID.
- El share contiene únicamente el snapshot `.fluyo.json`: páginas, nodos, flechas, labels, settings e imágenes embebidas que ya forman parte del documento.
- No añadir nombre de archivo local, contenido del clipboard fuera del documento, autosave anterior, historial de edición, selección, viewport del editor, datos de cuenta, IP, referrer ni identificadores analytics al JSON.
- La publicación es el único momento en que el contenido sale del navegador; requiere gesto y confirmación explícitos. Autosave, guardar/exportar y deep link no deben empezar a subir datos por este cambio.
- TLS protege el transporte, pero el enlace es una capability pública: reenviarlo da acceso. No hay autenticación ni revocación de terceros en v1; el creador puede retirar su propio share mediante `deleteToken` (§3, §4, §8) si lo conserva.
- **Retención:** no hay expiración automática en v1. No se promete almacenamiento permanente como SLA — simplemente no existe un TTL hasta que se decida añadir uno. El único mecanismo de retirada propio del creador en v1 es el `deleteToken`; si se pierde, no hay recuperación, y queda solo la vía operativa de reporte/retirada por abuso.
- La política de privacidad, comentarios del `<head>` y documentación deben actualizarse antes del lanzamiento para explicar esta excepción consentida a la promesa actual, incluyendo el texto exacto de confirmación y la naturaleza de capability URL del enlace.
- La página y API no deben enviar el ID, URL, query, fragmento, contenido ni `deleteToken` a Umami. D-004/D-007 siguen vigentes para analytics.

## 10. Analytics

**Decidido:** se mantienen los tres eventos sin propiedades ni identificadores de correlación. Esto entrega señal **agregada** (cuántos `share_created`/`share_viewed`/`share_opened_in_editor` ocurren en un periodo), no un funnel de conversión individual por share — no es posible saber si un share concreto fue visto o abierto en el editor. Se acepta esa limitación explícitamente a cambio de no introducir ningún identificador correlacionable en analytics (D-004/D-007). Si en el futuro se necesita un funnel real por share, eso exige una decisión de producto y privacidad nueva y explícita, no una ampliación silenciosa de estos eventos.

Nunca `id`, URL, número de páginas, tamaño, versión, `deleteToken` ni datos del documento.

| Evento | Superficie | Momento exacto | No cuenta |
|---|---|---|---|
| `share_created` | Editor | Tras `201` y parseo de una respuesta válida, con escritura confirmada por el servicio | Clic, abrir/cerrar modal, validación fallida, `POST` fallido |
| `share_viewed` | Viewer | Una vez por carga, tras `200`, validación/normalización y primer render útil del documento | Pageview, loading, 404, documento inválido, re-render o cambio de página |
| `share_opened_in_editor` | Editor | Tras aplicar realmente el snapshot como copia local editable | Clic en CTA, fetch fallido, cancelar o conservar el trabajo actual |

- Ampliar la lista cerrada de `ANALYTICS_EVENTS`; mantener las propiedades como `{}`.
- Separar el bootstrap de analytics por superficie: editor emite `editor_opened`; viewer no. Ambos reutilizan provider, cola y filtro de payload.
- El filtro sigue reconstruyendo URL/título constantes y excluyendo referrer/query/hash. No crear correlación entre creación, vista y apertura.
- No enviar analytics desde self-host/local, conforme a la política actual.

## 11. Frontera core OSS / servicio hospedado

### Core abierto

- Esquema/versionado `.fluyo.json`, fixtures y compatibilidad histórica.
- Serialización canónica, validación acotada y migraciones.
- Geometría, renderer Canvas, animaciones y carga segura de assets.
- Shell/controlador de viewer read-only y estados de loading/error.
- Navegación de páginas, zoom, pan y presentación.
- Flujo de importación como copia local y contrato de un `share loader` configurable.
- UI de consentimiento y mensajes de límites sin depender de un proveedor específico.

El core debe seguir siendo entendible y útil sin el servicio oficial. Un self-host puede apuntar el loader a su propia implementación compatible o desactivar Share; abrir/guardar local y `#d=` continúan funcionando.

**Embeds de terceros: decidido fuera de alcance de v1.** `frame-ancestors 'self'` por defecto (§8); no se diseña ni se ofrece una forma soportada de embeber el viewer en otros sitios. Revisar en una decisión posterior si aparece una necesidad concreta.

### Servicio hospedado de `fluyo.space`

- Routing limpio `/s/<id>` y `/api/shares`.
- Generación CSPRNG y reserva atómica de IDs.
- Object storage, disponibilidad, ETag/caché y retirada operativa.
- Validación server-side, límites del servicio, rate limiting y protección de origen.
- Cabeceras HTTP/CSP, logging mínimo y operación antiabuso.

La seguridad no depende de ocultar el frontend o el contrato de API. Cliente, formato y viewer pueden permanecer públicos; la barrera contra abuso son validación, límites y operación del servicio.

## 12. Alternativas descartadas y por qué

- Snapshot de render o esquema específico de viewer: duplica el modelo y rompe la importación fiel.
- Documento + representación derivada: complejidad de caché/versiones sin necesidad v1.
- IDs incrementales, fechas o slugs: enumerables o con información innecesaria.
- Base de datos y servidor residente: no hay consultas, usuarios ni mutaciones que los justifiquen.
- Editor completo escondido por CSS: no garantiza read-only y carga responsabilidades innecesarias.
- Segundo renderer: divergencia inevitable en geometría y animaciones.
- `#d=` como almacenamiento del share: no da URL corta estable ni resuelve límites del medio.
- `localStorage`/`sessionStorage` para `Open in Fluyo`: acopla pestañas y persistencia de forma frágil.
- URLs remotas y SVG aportados por el documento: permiten tracking/subrecursos o una superficie activa innecesaria.
- API pública de update/list: contradice snapshot inmutable y anticipa identidad/permisos. (`DELETE` autorizado por `deleteToken` sí se incorpora — no es una actualización ni requiere cuentas.)
- Persistir los bytes JSON crudos del `POST` tal cual llegan: permite que cliente y servicio diverjan en normalización con el tiempo. Se persiste la copia ya validada/normalizada (§1).
- Embeds de terceros (iframe) en v1: amplía superficie de seguridad/privacidad (clickjacking, referrer, CSP) sin una necesidad de producto probada. `frame-ancestors 'self'` por defecto; revisar más adelante si hace falta.
- Confiar en el default del navegador para `Referrer-Policy`: correcto hoy con navegadores modernos, pero no es una garantía fijada por el producto. Se declara explícitamente en el viewer.

## 13. Decisiones humanas — resueltas el 2026-09-28

Estas decisiones cambiaban contratos públicos u operación y requerían aprobación explícita. Todas quedaron resueltas salvo la única que depende de una elección de proveedor todavía no hecha (punto 3, diferido a `FLUYO-006`):

1. **Aprobado.** Share es una excepción explícita y consentida a la promesa «el contenido nunca sale del navegador» (D-004). Texto público exacto: **«Cualquiera con el enlace puede acceder a este diagrama.»** Requiere confirmación explícita del usuario antes de publicar (§9).
2. **Aprobado.** Snapshot inmutable del `.fluyo.json` completo; sin `update` de usuario en v1. Se añade `DELETE` autorizado por `deleteToken` como mecanismo de retirada del propio creador — no contradice la inmutabilidad del contenido (no se puede modificar un share, solo borrarlo entero).
3. **Diferido a `FLUYO-006`.** Elegir proveedor concreto de función + object storage + mecanismo de rate limiting/contador, y confirmar que soporta body de 2 MiB, escritura condicional, ETag, retirada y límites de coste/abuso adecuados. Es la única decisión de esta lista que sigue abierta, porque depende de una elección de infraestructura fuera del alcance de este diseño.
4. **Aprobado.** Límites iniciales (2 MiB, conteos estructurales, 1,5 MiB de imágenes) y exclusión de SVG/URLs remotas en shares, como configuración operativa revisable — no forman parte del contrato permanente del formato `.fluyo.json`.
5. **Aprobado.** Sin expiración automática en v1; sin promesa de permanencia como SLA. Retirada propia mediante `deleteToken` de alta entropía, devuelto una sola vez, con solo su hash persistido en el servidor (§3, §4, §8). Sin recuperación si se pierde. Se mantiene además la vía operativa de retirada por abuso, independiente del token.
6. **Aprobado.** Embeds de terceros fuera de v1. `frame-ancestors 'self'` por defecto (§8, §11).
7. **Aprobado.** `Open in Fluyo` ofrece sólo «abrir una copia» o «seguir con lo mío», sin «añadir como páginas» en v1 (§7).

Detalle de discoverability, aprobado junto con el punto 1: `/s/<id>` se sirve con `noindex, nofollow` (+ `X-Robots-Tag` cuando exista backend) y `Referrer-Policy` explícita (§5, §9). El enlace es una capability URL pública, no una URL que deba tratarse como autenticación fuerte.

La decisión durable correspondiente está registrada en `.ai/DECISIONS.md` como **D-008 — Share Foundation: snapshot inmutable, capability URL y retirada por token**.

## Plan de implementación posterior (decidido: tres tareas, no una)

La revisión arquitectónica encontró que `render.js`/`draw()` depende hoy de forma implícita de aproximadamente 15 globals mutables del editor (`selN`, `selE`, `drag`, `resizing`, `wpDrag`, `connectDrag`, `endDrag`, `marquee`, `mode`, `pendingShape`, `pendingIcon`, `pendingAnim`, `hoverNode`, `editing`, `presenting`), todos declarados sin separación en `js/state.js` junto con el modelo de documento real (`doc`, `settings`). Esa frontera debe existir en el código *antes* de construir el shell del viewer, no como parte del mismo cambio que lo construye. Por eso el trabajo se divide en tres tareas en vez de una sola `Share Core and Read-only Viewer`:

### `FLUYO-004` — Viewer Boundary

Objetivo: separar correctamente, dentro del editor actual y sin tocar su comportamiento:
- modelo/documento (`doc`, `settings`, fábricas, serialización, parser/migración/validación);
- estado mutable del editor (selección, drags en curso, modo, edición in-situ);
- estado del viewport (zoom/pan/página activa/presentación);
- renderer.

`render.js`/`draw()` deja de leer las ~15 globals de interacción del editor y pasa a **recibir explícitamente** el estado necesario para dibujar (documento/página + estado de vista + estado de interacción, como parámetros, no como variables libres). Editor y viewer deben poder invocar el mismo renderer pasando estados distintos. Sin backend. Sin Share remoto. Debe preservar el comportamiento actual del editor (mismos tests/checklist manual que ya existen).

### `FLUYO-005` — Read-only Share Viewer

Construir el shell de viewer independiente usando la frontera de `FLUYO-004`. Puede consumir inicialmente un fixture o un adapter local simulado (sin backend real). Incluye:
- pan, zoom, navegación entre páginas, animaciones, presentación;
- `Made with Fluyo`, `Open in Fluyo` (apuntando a un loader configurable, §11);
- `noindex, nofollow` en el HTML del shell;
- `Referrer-Policy` explícita.

Añadir fixtures y tests de compatibilidad/renderer idéntico frente al editor, y verificar ausencia de mutaciones/autosave/módulos de edición cargados en el viewer.

### `FLUYO-006` — Hosted Share Service

Implementar, una vez validados `FLUYO-004`/`FLUYO-005`:
- `POST`/`GET`/`DELETE /api/shares(/:id)`;
- object storage y función serverless/edge;
- generación de IDs y `deleteToken` (hash persistido, nunca el valor en claro);
- mecanismo de rate limiting/contador (tercera pieza de §3/§8);
- límites operativos (§8) y validación server-side compartiendo la misma semántica de normalización que el cliente (§1);
- elección de proveedor concreto (decisión diferida del punto 3 de §13).

Mantener esta tarea separada del refactor de renderer y del shell de viewer para que cada cambio siga siendo revisable de forma independiente y no mezcle infraestructura remota con el core del producto.

## Decisiones tomadas

- Recomendación original: documento canónico completo, snapshot inmutable, ID base64url de 128 bits, object storage + función mínima, viewer separado con core compartido y apertura como copia local.
- **Aprobado por revisión humana el 2026-09-28** (§13): excepción de privacidad con texto exacto, snapshot inmutable + `DELETE` por `deleteToken` (hash persistido, entrega única), sin expiración automática ni SLA de permanencia, `noindex`/`X-Robots-Tag`/`Referrer-Policy` en el viewer, embeds fuera de v1, `Open in Fluyo` sin «añadir páginas», documento persistido ya normalizado (no bytes crudos), rate limiting como tercera pieza explícita junto a función+storage, y analytics de tres eventos sin propiedades aceptando señal agregada en vez de funnel individual.
- Único punto diferido: elección de proveedor concreto de storage/edge/rate-limit (`FLUYO-006`).
- Se registró **D-008** en `.ai/DECISIONS.md` con el resumen durable de estas decisiones.
- Se dividió la implementación en tres tareas (`FLUYO-004` Viewer Boundary, `FLUYO-005` Read-only Share Viewer, `FLUYO-006` Hosted Share Service) en vez de una sola `Share Core and Read-only Viewer`, porque la frontera de estado entre editor y renderer no existe todavía en el código y merece su propio cambio revisable.
- No se diseñaron cuentas, permisos, colaboración, edición remota ni infraestructura futura fuera de v1.

## Archivos modificados

- `.ai/tasks/FLUYO-003.md` — arquitectura, alternativas, contratos, decisiones humanas resueltas, nuevo plan de implementación en tres tareas y handoff.
- `.ai/DECISIONS.md` — nueva entrada D-008.

## Pruebas

- Revisión dirigida del comportamiento real en `js/state.js`, `js/export.js`, `js/deeplink.js`, `js/render.js`, `js/interaction.js`, `js/ui.js`, `js/analytics.js`, `index.html` y `css/styles.css`.
- No corresponden pruebas de producto: no se modificó código servido ni se implementó Share.

## Pendientes / riesgos

- El normalizador actual es demasiado permisivo para documentos públicos remotos; no reutilizarlo solo sin añadir validación acotada. Sigue siendo trabajo de `FLUYO-006` (y de la extracción de `FLUYO-004` para la parte de validación acotada compartida).
- `render.js` depende hoy de ~15 globals mutables del editor declarados junto al modelo de documento en `js/state.js`, sin separación de archivo ni de contrato. Es el riesgo central que `FLUYO-004` existe para resolver antes de construir el viewer; ejecutarlo como una extracción superficial (declarar globals vacíos en el viewer en vez de pasar estado explícito) reproduciría el acoplamiento en vez de eliminarlo.
- `analytics.js` mezcla provider y editor; cargarlo sin separar en viewer podría emitir eventos erróneos o fallar por globals ausentes. Pendiente de `FLUYO-005`.
- Imágenes SVG o remotas que hoy puedan entrar por JSON no deben publicarse sin una política explícita; la recomendación v1 (rechazarlas) queda aprobada, pendiente de implementar la validación en `FLUYO-006`.
- No se conoce en este repositorio el hosting actual. La elección de proveedor (incluyendo el mecanismo de rate limiting/contador) y las reglas de rewrite quedan explícitamente diferidas a `FLUYO-006` (§13 punto 3).
- Un share sin cuenta no tiene revocación de terceros ni recuperación fiable si se pierde la respuesta de creación o el `deleteToken`. Ya se decidió el mecanismo de mitigación (retirada por `deleteToken` + vía operativa de abuso); sigue siendo un límite real de v1 que debe comunicarse al usuario en el texto de consentimiento.

## Handoff

### Estado actual

DONE como tarea de arquitectura, con las siete decisiones humanas de §13 revisadas y resueltas el 2026-09-28 (seis aprobadas, una diferida a `FLUYO-006` por depender de elección de proveedor). La revisión arquitectónica añadió el mecanismo de `deleteToken`, la discoverability (`noindex`/`X-Robots-Tag`/`Referrer-Policy`), la persistencia del documento ya normalizado y la división del plan de implementación en tres tareas en vez de una. Se leyó únicamente el contexto declarado: `AGENTS.md`, esta tarea, y búsquedas/secciones dirigidas del código relevante (`js/state.js`, `js/render.js`, `js/geometry.js`, `js/interaction.js`, `js/deeplink.js`, `js/export.js`, `js/analytics.js`) y de `.ai/DECISIONS.md`. No se leyó PRODUCT, otras tareas ni repositorios hermanos.

No se implementó Share, backend, dependencias ni archivos servidos; no se modificó el service worker ni ningún archivo de código productivo. No hubo commit ni push. Se registró **D-008** en `.ai/DECISIONS.md`.

### Próximo paso concreto

Crear `FLUYO-004 — Viewer Boundary`: separar modelo/documento, estado mutable del editor, estado de viewport y renderer, de modo que `render.js`/`draw()` reciba explícitamente el estado necesario para dibujar en vez de leer las ~15 globals de interacción del editor. Sin backend, sin Share remoto, preservando el comportamiento actual del editor. Solo después de validar esa frontera, continuar con `FLUYO-005` (shell de viewer) y `FLUYO-006` (servicio hospedado).
