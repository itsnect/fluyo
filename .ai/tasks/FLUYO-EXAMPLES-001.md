# FLUYO-EXAMPLES-001 — Los ejemplos como onboarding

Estado: **IMPLEMENTED · commit local, sin push ni deploy** (28-10-2026). El PO reanudó la tarea tras I18N-002 S3b y pidió implementar directamente; ver «Implementación (28-10-2026)» al final.
Owner/agente actual: Claude Code

> **Repo público**: este documento es apto para publicarse. No contiene métricas privadas, estrategia comercial ni roadmap privado.
>
> **Qué NO se ha hecho**: no se ha tocado ningún archivo servido, no hay commit, push ni deploy, y CACHE sigue en v107. El prototipo del ejemplo canónico (§4) vive solo fuera del repo, en el scratchpad de la sesión, y se ha validado con el kernel real y en el Viewer de producción a través de un enlace `#d=`. Ese enlace no envía el documento a ningún servidor.

## Objetivo

Que los ejemplos enseñen **el producto real**: *crear → explicar → presentar → compartir*. Hoy solo enseñan diagramas.

Cualquiera que abra el ejemplo base debería entender en 30–60 s esto: **«No es solo un diagrama. Puedo explicar cómo funciona un sistema y reproducirlo»**.

## Base auditada

- Commit: `main` en `53552a2`, la misma versión que sirve fluyo.space (CACHE v107).
- Código revisado:
  - `ejemplos/index.html` y `ejemplos/data/*.fluyo.json`;
  - `js/examples.js`;
  - el botón «Ejemplo» (`js/export.js:85`);
  - `sw.js`, `js/analytics.js`, `docs/`, `README.md` y `CONTRIBUTING.md`;
  - el modelo de Historias (`model.js`, `scenario-engine.js`, `story-playback.js`, `story-clock.js`);
  - el Viewer (`viewer.js`).
- Producto real (navegador integrado contra fluyo.space):
  - galería a 1024×768 y a 375×812;
  - editor con `?ejemplo=oauth2-flujo-autenticacion` a 800×600 y a 1366×800;
  - Viewer `/s/#d=` con el prototipo, a 1366×800 y a 375×812.

---

## 1. Diagnóstico actual

**Ningún ejemplo enseña lo que hoy diferencia a Fluyo.** Lo medido:

| # | Hecho | Evidencia |
|---|---|---|
| H1 | **0 de 8** ejemplos de la galería tienen Historia, Narration o EventTypes. | Los 8 JSON tienen `pages[0]` con `name, nodes, edges, nextId` y nada más. |
| H2 | El botón **«Ejemplo»** del editor tampoco tiene Historia. Es un funnel de ventas cableado en código, con `build:true` y sin EventTypes. | `js/export.js:85-110` |
| H3 | Al abrir un ejemplo, el panel Historias dice «Sin historias · Aún no hay historias» y «Reproducir» está deshabilitado. | Editor, `?ejemplo=oauth2-…`, modo Historias |
| H4 | La galería no nombra **ni una vez** Historia, reproducir, Present, compartir ni enlace. Sí nombra el GIF 3 veces, y el GIF no lleva la Historia. | `innerText` de `/ejemplos/` |
| H5 | Los ejemplos simulan con trucos estáticos lo que hoy hace una Historia. OAuth numera el orden en las etiquetas («1. iniciar sesión» … «6. 200 OK»). Los tres de negocio usan la aparición escalonada (`build`) para insinuar secuencia. | `oauth2-…json`; `settings.build` en funnel, onboarding y cadena |
| H6 | La animación de los puntos es decorativa: los puntos recorren todas las flechas a la vez y no cuentan un orden ni un resultado. | Todos los ejemplos |
| H7 | La galería es larga y está centrada en el texto:<br>• escritorio: 6,4 pantallas, tarjetas de 66–81 palabras;<br>• móvil (375 px): 7,4 pantallas, el primer botón «Abrir en el editor» en y = 1076, por debajo del pliegue;<br>• preview de 313×123 px, con etiquetas ilegibles. | Medido en la página real |
| H8 | La galería usa el tema oscuro (`css/pages.css`, `--bg:#111213`) y el producto el crema/papel. Visualmente son dos productos distintos. | Capturas |
| H9 | En el editor, el «Ejemplo» está a tres niveles: «Más» → Archivo → «Ejemplo». El enlace a la galería está en «Más» y en el pie. | `index.html:266, 313` |
| H10 | La única acción de cada tarjeta es entrar al **editor**, la superficie más cargada del producto. No hay forma de *ver* un ejemplo funcionando sin editarlo. | `ejemplos/index.html` |

Conclusión: los ejemplos venden una versión anterior del producto, *diagrama animado → GIF*. La capacidad que hoy separa a Fluyo de un diagrama estático es la Historia narrada que se reproduce, se presenta y se comparte, y **no aparece en ningún punto del recorrido de un visitante nuevo**.

---

## 2. Catálogo actual

Leyenda: H = tiene Historia, N = tiene Narration, R = se puede reproducir, ≠E = demuestra algo que un diagrama estático no puede.

| Ejemplo | Qué enseña | Qué NO enseña | H | N | R | ≠E | Veredicto |
|---|---|---|---|---|---|---|---|
| **Funnel de ventas** (y el botón «Ejemplo», que es una variante cableada) | Rombo de decisión, aparición escalonada, rama descartada (discontinua). | Historia, frase, resultado, fallo, Present/Share. Su «movimiento» es el `build`, no un comportamiento. | ✗ | ✗ | ✗ | ✗ (el `build` solo revela el dibujo) | **ELIMINAR**. El ejemplo canónico ocupa su papel en el botón. |
| **Onboarding de cliente** | Plazos en las conexiones, bucle de refuerzo. | Que el bucle *ocurre*: el estático solo lo dibuja. | ✗ | ✗ | ✗ | ✗ | **ELIMINAR**, o ACTUALIZAR como 4.º ejemplo de proceso (D1). |
| **Cadena de suministro** | Nodo animado «En tránsito» como estado, reaprovisionamiento. | Comportamiento: el «stock bajo» nunca ocurre. | ✗ | ✗ | ✗ | ✗ | **ELIMINAR** |
| **Pipeline de eventos (Kafka)** | Productores/consumidores, DLQ, ruta transaccional y analítica. | Que un evento se reparte **a la vez** a dos consumidores, y que un fallo acaba en la DLQ. Es justo lo que una Historia cuenta mejor. | ✗ | ✗ | ✗ | ✗ hoy; ✓ con Historia | **ACTUALIZAR** (catálogo n.º 3) |
| **Microservicios con API Gateway** | Un servicio por base de datos, caché, event bus. | Nada de comportamiento. Su valor es estructural, y un diagrama estático ya lo cuenta bien. | ✗ | ✗ | ✗ | ✗ | **ELIMINAR**. Se solapa con Kafka y con el canónico. |
| **OAuth 2.0** | El orden de un protocolo de ida y vuelta (con el orden escrito en las etiquetas). | La secuencia real: ida y vuelta por la misma conexión (`reverse`), el consentimiento como momento y qué pasa si el usuario no autoriza. | ✗ | ✗ | ✗ | ✗ hoy; ✓ con Historia | **ACTUALIZAR** (catálogo n.º 2). Es el mejor candidato existente porque su contenido *es* un orden. |
| **Pipeline ETL** | Tres orígenes, validación que bifurca a cuarentena, GIF de progreso. | Comportamiento; el GIF es decorativo. | ✗ | ✗ | ✗ | ✗ | **ELIMINAR** |
| **Serverless en AWS** | Mapa de servicios gestionados con iconos de proveedor. | Comportamiento; un mapa de componentes. | ✗ | ✗ | ✗ | ✗ | **ELIMINAR** |

Ninguno es **MANTENER** tal cual: un ejemplo sin Historia no demuestra el producto actual.

---

## 3. Catálogo recomendado

**Tres ejemplos de sistema y un cuarto opcional (D1).** Cada uno existe porque enseña una capacidad que los otros no enseñan. Todos tienen Historia narrada en el 100 % de sus pasos.

| # | Nombre | Objetivo | Sistema | Historia(s) | Qué aprende el usuario | Por qué existe |
|---|---|---|---|---|---|---|
| 1 | **Compra online** *(canónico; también el botón «Ejemplo»)* | Entender Fluyo en 30–60 s. | Cliente · Tienda online · Pagos · Banco · Almacén (5 nodos, 4 conexiones) | «Compra con éxito» (7 pasos)<br>«El banco no responde» (6 pasos) | • Una Historia narrada se reproduce paso a paso.<br>• Las respuestas vuelven por la misma conexión.<br>• Un mismo sistema tiene varias Historias.<br>• Un fallo se ve: un paso «no se completó». | Es la puerta de entrada. Lo entiende cualquiera, técnico o no, y cabe en una pantalla. |
| 2 | **Inicio de sesión con OAuth 2.0** *(actualiza el actual)* | Explicar un protocolo cuyo contenido es el orden. | Usuario · App · Servidor de autorización · API protegida (+ «¿Autoriza?» como momento) | «Iniciar sesión» (≈ 8 pasos, con idas y vueltas y un paso de elemento con globo: «El usuario da su consentimiento»)<br>Opcional: «El usuario no autoriza» | • La Historia sustituye a las etiquetas numeradas.<br>• Los pasos de elemento llevan globo.<br>• Una secuencia larga se puede seguir, pausar y saltar (⏮ ⏭). | Es el caso de uso técnico por excelencia, explicar un flujo a alguien nuevo en el equipo. Demuestra que el orden no se puede leer en un estático. |
| 3 | **Pedido asíncrono con cola** *(actualiza Kafka y absorbe lo útil de serverless/SQS)* | Explicar lo que ocurre a la vez y lo que ocurre después. | API · Cola de eventos · Pagos · Envíos · DLQ (≈ 6 nodos) | «Un pedido» (con un momento simultáneo: la cola reparte a Pagos y Envíos **al mismo tiempo**; el cliente recibe respuesta *antes* de que termine el trabajo)<br>«Un mensaje que falla» (va a la DLQ) | • Pasos simultáneos (grupos «al mismo tiempo»).<br>• Asincronía: la respuesta llega antes que el resultado.<br>• Ruta de error. | La simultaneidad y la asincronía son lo que más cuesta explicar en una pizarra y lo que peor cuenta un diagrama estático. |
| 4 *(opcional, D1)* | **Onboarding de cliente** *(actualiza el actual)* | Demostrar que Fluyo vale para procesos que no son software. | El actual, simplificado (≤ 7 nodos) | «Un cliente nuevo» (incluye el bucle de refuerzo: la formación se repite) | • Un proceso de personas se explica igual que un sistema.<br>• Un bucle *ocurre*. | `.ai/PRODUCT.md` dice que Fluyo no es exclusivamente software. Si el PO quiere mostrarlo, este es el que mejor lo hace. |

Capacidades cubiertas sin repetir:

- Narration, reproducir, Present y Share: los cuatro.
- Varias Historias: n.º 1 y n.º 3.
- Respuesta (`reverse`): n.º 1 y n.º 2.
- Fallo y disponibilidad: n.º 1.
- Ruta de error: n.º 3.
- Globo de elemento: n.º 2.
- Simultaneidad y asincronía: n.º 3.
- Bucle y proceso no-software: n.º 4.

Fuera del catálogo a propósito:

- Las semánticas congeladas o de laboratorio: Flow/Requisito, dependencias de llegada, ruta observada.
- Las pieles.

Un ejemplo de entrada no debe exigir conceptos avanzados.

---

## 4. Nuevo ejemplo base: «Compra online»

### Sistema

```
 Cliente ──► Tienda online ──► Pagos ──► Banco
                  │
                  ▼
               Almacén
```

| id | Nodo | Forma |
|---|---|---|
| 1 | Cliente | icono `user` |
| 2 | Tienda online | icono `web` |
| 3 | Pagos | rect |
| 4 | Banco | rect |
| 5 | Almacén | rect |

| id | Conexión |
|---|---|
| 6 | Cliente → Tienda |
| 7 | Tienda → Pagos |
| 8 | Pagos → Banco |
| 9 | Tienda → Almacén |

**EventTypes** (3, reutilizables; las frases van en cada paso y no hay un evento por frase, decisión 258):

| id | Nombre | Primitiva |
|---|---|---|
| 1 | Petición | `FLOW` |
| 2 | Respuesta | `FLOW` (se usa con `reverse`) |
| 3 | Caída | `SET_AVAILABILITY` → `DOWN` |

### Qué se descubre al reproducir (y un estático no puede contar)

1. **Orden.** En el dibujo, Tienda→Pagos y Tienda→Almacén parecen dos salidas independientes. Al reproducir se ve que **el almacén solo se entera después de que el banco autoriza**.
2. **Ida y vuelta.** Las respuestas recorren las mismas conexiones en sentido contrario, aunque el dibujo solo tiene flechas de ida.
3. **Dependencia invisible.** No hay ninguna flecha Banco→Almacén. Aun así, si el banco cae, el pedido **nunca llega** al almacén.

Esto se cuenta con honestidad: la dependencia la narra el autor y Fluyo la reproduce de forma determinista. **No es un simulador.** El texto de la galería debe decir *explicar y reproducir*, nunca *simular* (D11).

### Medición del prototipo

Prototipo construido con el kernel real; el script `proto-ejemplo.cjs` está fuera del repo.

- `FluyoIntegrity.validateProject` da `valid: true`, sin errores.
- «Compra con éxito»: los 7 pasos dan `completed`.
- «El banco no responde»:
  - paso 3 `state_changed` UP→DOWN;
  - paso 4 `not_completed`, razón `target_down`, nodo 4;
  - el resto `completed`.
- Enlace `#d=` de una Historia: unos 1 400 caracteres.
- Viewer de producción a 1366×800:
  - el rótulo dice la frase de cada momento, con el contador «n / 7»;
  - en el fallo, el paso 4 se lee «En pausa · No se completó · Banco no está disponible», con la ficha detenida antes del banco;
  - el cierre dice «Reproducción terminada · 1 evento no pudo realizarse».
- **Ritmo.** Con 1,6 s entre momentos, la Historia de éxito dura 9,7 s. Es **demasiado rápido** para frases de 6–8 palabras.
  - Recomendación: **2,4 s** por momento (D8).
  - Éxito ≈ 16 s, fallo ≈ 13 s.
  - Con unos 5 s para mirar el diagrama y las transiciones, el recorrido completo (diagrama → éxito → fallo) queda en **unos 40 s**, dentro del objetivo de 30–60 s.
- **Teléfono vertical (375×812).**
  - Reproduciendo, la cámara sigue el momento (decisión 259) y se lee bien.
  - Antes de reproducir, con la composición en línea de 4 columnas, el diagrama entero sale diminuto y las etiquetas no se leen.
  - Requisito para la implementación: **composición compacta**, 3×2 o 2×3: por ejemplo Banco bajo Pagos y Almacén bajo Tienda. El diagrama entero debe leerse a zoom ≥ 0,6 en 390 px de ancho, sin cámara que siga.

### Historia de fallo

Se recomienda incluirla en el ejemplo base porque es la que demuestra el «≠ estático». Ver §5 y §6.

---

## 5. Historias propuestas

| Ejemplo | Historia | Pasos | Capacidad que enseña |
|---|---|---|---|
| Compra online | **Compra con éxito** | 7 (4 peticiones, 3 respuestas) | Narration, orden, ida y vuelta |
| Compra online | **El banco no responde** | 6 (caída + intento fallido + 2 respuestas) | Fallo visible, dependencia, varias Historias por sistema |
| OAuth 2.0 | **Iniciar sesión** | ≈ 8 | Secuencia larga, globo de elemento, ⏮ ⏭ |
| OAuth 2.0 | *El usuario no autoriza* (opcional) | ≈ 5 | Rama alternativa |
| Pedido asíncrono | **Un pedido** | ≈ 7, con un momento simultáneo | «Al mismo tiempo», asincronía |
| Pedido asíncrono | **Un mensaje que falla** | ≈ 5 | Ruta de error (DLQ) |
| Onboarding *(opcional)* | **Un cliente nuevo** | ≈ 7, con el bucle repetido | Proceso no-software, repetición |

Orden de las Historias en el documento: primero la del camino feliz, que es la que abre el editor y la que se ve primero.

## 6. Narration propuesta (ejemplo base)

Las reglas de estilo valen para todos los ejemplos:

- presente;
- sujeto primero;
- ≤ 60 caracteres, para que quepan en una línea en Present y en el Viewer;
- sin jerga;
- una sola idea por paso;
- la frase dice **lo que pasa**, no el nombre del evento.

**Compra con éxito**

| # | Paso | Frase |
|---|---|---|
| 1 | Petición · Cliente→Tienda | El cliente pulsa «Pagar» (49 €) |
| 2 | Petición · Tienda→Pagos | La tienda pide a Pagos que cobre |
| 3 | Petición · Pagos→Banco | Pagos pide al banco que autorice la tarjeta |
| 4 | Respuesta · Banco→Pagos (`reverse`) | El banco autoriza el cobro |
| 5 | Respuesta · Pagos→Tienda (`reverse`) | Pagos confirma a la tienda: cobrado |
| 6 | Petición · Tienda→Almacén | **Solo ahora** la tienda avisa al almacén |
| 7 | Respuesta · Tienda→Cliente (`reverse`) | El cliente recibe «Pedido confirmado» |

**El banco no responde**

| # | Paso | Frase |
|---|---|---|
| 1 | Petición · Cliente→Tienda | El cliente pulsa «Pagar» (49 €) |
| 2 | Petición · Tienda→Pagos | La tienda pide a Pagos que cobre |
| 3 | Caída · Banco | El banco deja de responder |
| 4 | Petición · Pagos→Banco (falla: `target_down`) | Pagos intenta autorizar… sin respuesta |
| 5 | Respuesta · Pagos→Tienda (`reverse`) | Pagos avisa a la tienda: cobro no realizado |
| 6 | Respuesta · Tienda→Cliente (`reverse`) | El cliente ve «Pago no completado». El almacén no recibe nada |

El paso 6 del fallo supera las 60 unidades. Se recortará en la implementación, por ejemplo a «El cliente ve «Pago no completado»», y la ausencia del almacén se verá: nunca se ilumina.

**Hallazgo menor (fuera de alcance).** En un paso de elemento con `message`, como «El banco deja de responder», la frase sale a la vez en el globo y en el rótulo, y debajo «Banco no está disponible». Es redundante pero no confunde. Se apunta para una slice de Narration, no para esta.

---

## 7. UX de la galería

### ¿Experimentar una Historia antes de entrar al editor?

**Sí. Es la recomendación central (D5).**

- El Viewer ya hace lo que hace falta: es de solo lectura, no tiene chrome de editor, tiene un botón grande «▶ Reproducir historia», sigue el momento en el teléfono y funciona sin red tras la primera visita (decisión 262).
- El editor exige, para ver lo mismo: modo Historias → «Reproducir». Además rodea el diagrama de herramientas que el visitante todavía no necesita.
- Orden correcto del recorrido: **ver → entender → editar**, que es el loop del producto empezando por *explicar*.

### Tarjeta (propuesta)

```
┌───────────────────────────────────────────┐
│ [preview crema, legible en 390 px]        │
├───────────────────────────────────────────┤
│ Compra online                             │
│ Qué pasa cuando alguien paga, y qué       │
│ pasa si el banco no responde.             │  ← ≤ 20 palabras (hoy 66–81)
│ ◉ 2 historias · narrada · fallo           │  ← indicadores
│ [▶ Ver: Compra con éxito]                 │  ← primaria → Viewer
│ [▶ Ver: El banco no responde]             │  ← una por Historia
│ Abrir en el editor · Descargar .fluyo     │  ← secundarias, texto
└───────────────────────────────────────────┘
```

- **Preview:** imagen estática del diagrama en crema (hoy son SVG oscuros de 313×123 px en móvil).
  - Debe leerse en 390 px; eso vuelve a exigir composiciones compactas.
  - No lleva reproductor embebido en la v1: cargar el kernel de render en `/ejemplos` cuesta unos 500 kB, y el GIF no puede llevar la Historia.
- **Indicador de Historias:** «◉ N historias», contado de `scenarios`.
- **Indicador de Narration:** «narrada» si **todos** los pasos tienen `message`. En el catálogo propuesto lo están todos, pero el indicador deja de ser cierto en cuanto alguien añade un ejemplo sin frases. Un test lo vigila (§10).
- **Chips de capacidad** (lista cerrada, máximo 2 por tarjeta): `fallo`, `respuestas`, `al mismo tiempo`, `proceso`.
- **Acción principal:** «▶ Ver: <Historia>», que abre el Viewer con esa Historia.
  - Una acción por Historia, porque el Viewer reproduce solo `scenarios[0]` y no tiene selector.
  - El enlace lleva el documento **entero**, con la Historia elegida en primera posición. Así «Abrir en Fluyo» desde el Viewer trae también la otra Historia.
- **Abrir en el editor:** `?ejemplo=<slug>`, igual que hoy: URL corta, indexable y enlazable (justificación en `js/examples.js`).
- **Reproducir:** en el Viewer, sin autoplay (D7). El botón grande ya es inequívoco, y el autoplay cambiaría el Viewer para todos los enlaces compartidos.
- **Editar:** desde la tarjeta («Abrir en el editor») y desde el Viewer («Abrir en Fluyo», que ya existe).
- **Cabecera de la página:**
  - una frase sobre el producto: «Diagramas que explican cómo funciona un sistema y se reproducen paso a paso»;
  - fuera «expórtalo como GIF animado» y la nota de JSON en la primera pantalla (pasa al pie);
  - fuera las secciones «Procesos de negocio / Arquitectura»: con 3–4 ejemplos no hacen falta.
- **Tema:** crema, como el producto (D10).
- **Objetivo medible:** la galería cabe en ≤ 2 pantallas en escritorio, y en móvil la primera acción «▶ Ver» queda dentro de la primera pantalla.

---

## 8. Relación con onboarding

El recorrido propuesto empieza explicando y termina creando:

1. **Galería** → «▶ Ver: Compra con éxito» (Viewer, ≈ 16 s) → «▶ Ver: El banco no responde» (≈ 13 s).
   Ya ha visto *explicar* y *presentar*.
2. **Abrir en Fluyo / en el editor.** El documento llega con sus dos Historias.
   Recomendación (D4): abrir en modo **Historias**, con la primera seleccionada, de modo que «▶ Reproducir» y la lista de pasos con sus frases sean lo primero que se vea.
3. **Cambiar una frase** («Mensaje del paso…») y reproducir de nuevo: el usuario ya ha *creado*.
4. **Presentar** y **Compartir**: el loop completo sobre un sistema que ya entiende.

En el editor:

- el botón «Ejemplo» («Más» → Archivo) carga **el mismo canónico**, con sus Historias;
- no habrá dos «ejemplos base» distintos (hoy el botón es un funnel que no está en la galería).

Fuera de esta tarea (una slice de onboarding aparte, si el PO quiere):

- llevar el ejemplo al lienzo vacío de la primera visita, por ejemplo «Ver un ejemplo en 30 s»;
- sacarlo del menú «Más», donde hoy está a tres niveles (H9).

Esta tarea deja el ejemplo listo para ese uso, pero no cambia la primera visita.

---

## 9. Qué eliminar

| Elemento | Acción |
|---|---|
| Ejemplos **Funnel de ventas, Cadena de suministro, Microservicios, ETL, Serverless AWS** | Fuera de la galería, del JSON-LD y de los textos. |
| Funnel cableado en `js/export.js` (botón «Ejemplo») | Sustituido por el canónico. |
| Onboarding de cliente | Fuera, salvo que D1 lo mantenga como 4.º actualizado. |
| Etiquetas numeradas de OAuth («1. …», «6. …») | Fuera: el orden lo cuenta la Historia. |
| Texto de la galería sobre GIF como resultado principal, y las secciones por categoría | Fuera. |
| `?ejemplo=<slug>` de los retirados | **No romper los enlaces existentes** (D2). Recomendado: los slugs siguen en la lista blanca como «retirados», cargan su JSON de siempre y no se listan. Alternativa: redirigirlos al canónico. |
| Valores de `example_loaded` en `analytics.js` | Se conservan para no partir la serie; se añaden los nuevos slugs. `demo` sigue siendo el valor del botón. |

---

## 10. Alcance técnico (para las slices de implementación; nada se hace aquí)

**Sin cambios en el kernel, el formato `.fluyo.json` (v5, engineVersion 2), el motor, el MCP ni el Viewer.** Todo lo necesario ya existe: `message` en cualquier paso, `reverse`, `SET_AVAILABILITY`, el Viewer con Historia, `?ejemplo=` con lista blanca y la caché del Viewer.

### EX-1 · Ejemplo canónico + botón «Ejemplo» (CACHE v108)

- `ejemplos/data/compra-online.fluyo.json`, con la composición compacta y el ritmo de 2,4 s.
- `js/examples.js`: slug nuevo en `EXAMPLES`.
- `js/export.js` (`btnDemo`): cargar el canónico en una página nueva (decisión 122, sin cambios), con su Historia activa y, si se aprueba D4, en modo Historias.
- Una sola fuente de verdad, el JSON:
  - el botón lo carga con `fetch`;
  - el JSON pasa a la lista **obligatoria** de `sw.js` (`ASSETS`), no a la «si se puede», para conservar lo que justificaba tenerlo cableado: funcionar sin red.
  - Alternativa equivalente: mantenerlo embebido, con un test que exija igualdad byte a byte con el JSON.
- `js/analytics.js`: valor `compra-online` en la lista cerrada.
- `docs/index.html`: la frase de «Ejemplo».
- Tests:
  - **vm:**
    - `validateProject` válido;
    - outcomes exactos: el éxito todo `completed`; el fallo, exactamente un `not_completed` con `target_down` en el paso 4;
    - todas las frases ≤ 60 unidades;
    - 100 % de pasos con `message`;
    - 3 EventTypes.
  - **Chrome:**
    - el botón crea la página y la Historia se reproduce;
    - Present;
    - Viewer a 1440, 390 y 844×390;
    - en vertical, el diagrama entero a zoom ≥ 0,6 sin cámara que siga;
    - es/en de la interfaz, sin traducir el contenido.
  - Mutaciones, undo de la slice, fijación de CACHE.

### EX-2 · Galería (CACHE v109)

- `ejemplos/index.html` reescrito: 3–4 tarjetas, indicadores, «▶ Ver», JSON-LD y meta sin el discurso del GIF.
- `css/pages.css`: crema (D10). Afecta también a `/docs`, que comparte hoja: decidir si va junto o con un alcance limitado a `/ejemplos`.
- Previews regenerados con el exportador (crema, composición compacta).
- **Enlaces «▶ Ver» (D6):** recomendado, `#d=` **precalculados** (unos 1 400 caracteres cada uno).
  - Un script en `test/` los regenera desde los JSON.
  - Un test de deriva exige que el enlace publicado sea `encodeDeepLink` del JSON actual, con la Historia rotada a la primera posición.
  - Sin código nuevo en el Viewer, sin caché nueva, y funcionan sin red con la caché del Viewer (decisión 262).
  - Alternativa: `?ejemplo=` en el Viewer, con la misma lista blanca. Las URL quedan más cortas, pero hay código nuevo en `share-loader`/`viewer`, la lista blanca se comparte y hay que decidir la caché sin red.
- Slugs retirados según D2.
- `README.md`, `CONTRIBUTING.md` («añadir un ejemplo»), `sitemap.xml` sin cambios de URL.
- Tests:
  - la galería solo lista slugs de la lista blanca;
  - cada «narrada» es cierta;
  - deriva de `#d=`;
  - alturas medidas: escritorio ≤ 2 pantallas, móvil con «▶ Ver» en la primera pantalla.

### EX-3 · OAuth y Pedido asíncrono con Historias (CACHE v110)

- Los dos JSON actualizados con sus Historias y frases.
- Sus tarjetas, tests vm (validez, outcomes) y Chrome (Viewer).

### EX-4 · (posterior) Ediciones en inglés

- Ver I18N, abajo. Depende de que la galería y las páginas estáticas tengan versión EN.

### Fuera de todas las slices

- Primera visita y lienzo vacío (onboarding).
- Reproductor embebido en la galería.
- Autoplay del Viewer.
- Selector de Historias en el Viewer.
- Las plantillas del MCP (`fluyo-mcp/src/templates.ts`: tres plantillas sin Historias, un catálogo distinto). Alinearlas es un seguimiento opcional en el repo del MCP.

### I18N (conceptual)

Se aplica la decisión 260: la interfaz sigue a quien mira y el contenido del autor queda en su idioma.

- **Se traduce la interfaz de la galería:** títulos, descripciones de tarjeta, indicadores («2 historias», «narrada»), botones («▶ Ver», «Abrir en el editor»). Las páginas estáticas ya siguen el patrón de una página por idioma (`privacidad/`/`privacy/`, `soporte/`/`support/`). La galería tendría `ejemplos/` y `examples/`.
- **No se traduce dinámicamente el contenido:** nombres de nodos, nombres de Historias, frases de los pasos, nombres de EventTypes. No se añaden claves de traducción al `.fluyo.json` y no cambia el formato.
- **Ediciones por idioma:** cada ejemplo es un documento escrito a mano en cada idioma. Por ejemplo `ejemplos/data/compra-online.fluyo.json` y `examples/data/online-checkout.fluyo.json`, con la misma estructura.
  - Un test de paridad exige los mismos ids, formas, conexiones, `at`, acciones, `reverse` y estados.
  - Solo puede diferir el texto: `label`, `name`, `message`, `sentenceTemplate`.
- **El idioma se elige en el momento de crear, no después:**
  - el botón «Ejemplo» y la galería cargan la edición del idioma de la interfaz;
  - una vez cargado, es un documento del usuario y se queda en ese idioma aunque luego cambie la interfaz;
  - un enlace compartido muestra el contenido en el idioma del autor y la interfaz en el de quien mira (como hoy).
- **v1 solo en español** (D9). La estructura queda preparada para EX-4.

---

## 11. Decisiones que necesitan al PO

| # | Decisión | Recomendación |
|---|---|---|
| **D1** | Tamaño del catálogo: 3 ejemplos de sistema, o 3 + un 4.º de proceso no-software (Onboarding con Historia). | **3 + 4.º opcional en EX-3** si se quiere sostener que Fluyo no es solo software; si no, 3. |
| **D2** | Retirar 5 ejemplos (Funnel, Cadena, Microservicios, ETL, Serverless). Qué pasa con sus `?ejemplo=`. | Retirar de la galería; **los slugs siguen cargando** sin listarse. |
| **D3** | Ejemplo canónico: «Compra online» (5 nodos, éxito + fallo). Alternativas: un login o un pedido de comida. | **Compra online.** Universal, técnico sin jerga, y su fallo demuestra el «≠ estático». |
| **D4** | El botón «Ejemplo» carga el canónico **y abre en modo Historias** con la primera Historia activa. | **Sí.** |
| **D5** | La acción principal de la tarjeta es **ver la Historia en el Viewer** antes de entrar al editor. | **Sí.** |
| **D6** | Mecanismo de «▶ Ver»: `#d=` precalculado con test de deriva, o `?ejemplo=` en el Viewer. | **`#d=` precalculado** (cero código de runtime). |
| **D7** | Autoplay del Viewer al llegar desde la galería. | **No** en esta serie. |
| **D8** | Ritmo de los ejemplos: 2,4 s entre momentos (medido: 1,6 s es demasiado rápido para leer). | **2,4 s.** |
| **D9** | I18N: ediciones por idioma escritas a mano, elegidas al cargar; nunca traducción dinámica del contenido. v1 solo ES. | **Sí.** |
| **D10** | La galería pasa al tema crema del producto; decidir si `/docs` cambia a la vez (comparten `pages.css`). | **Crema; `/docs` en la misma slice** para no tener dos identidades. |
| **D11** | Mensaje de producto en los textos: «explicar y reproducir», nunca «simular». Fuera el GIF como promesa principal. | **Sí.** |

---

## Handoff

- **Qué se hizo:**
  - auditoría de código y del producto real (galería, editor y Viewer en escritorio y móvil);
  - catálogo actual clasificado;
  - catálogo recomendado;
  - ejemplo canónico diseñado, prototipado fuera del repo, validado con el kernel y visto reproducirse en el Viewer de producción;
  - alcance técnico por slices;
  - 11 decisiones para el PO.
- **Archivos modificados:** solo este documento (sin commit).
- **Pruebas:** ninguna suite. Mediciones en el navegador:
  - alturas de la galería;
  - estado del panel Historias con un ejemplo;
  - rótulos y tiempos del Viewer: 7 momentos cada 1 600 ms, primer rótulo a los 103 ms;
  - teléfono vertical.

  Además, la validación vm del prototipo.
- **Riesgos:**
  - D2: romper enlaces `?ejemplo=` existentes si se borran slugs;
  - el «narrada» de la galería puede volverse falso con ejemplos futuros sin frases (lo cubre un test);
  - la composición compacta es un requisito, no una preferencia (sin ella, el ejemplo no se lee en el teléfono antes de reproducir).
- **Próximo paso concreto:** ver «Pausa».

## Pausa (25-10-2026)

**El PO aprobó la auditoría como READY FOR IMPLEMENTATION y pausó deliberadamente la ejecución.** EXAMPLES se coordina con **FLUYO-I18N-002 S7** («Páginas públicas, SEO y ejemplos»), porque las páginas públicas y los ejemplos forman parte de la localización completa.

**Queda fijado de esta auditoría:**

- El ejemplo base trae Historias desde el primer momento.
- Todo ejemplo publicado tiene al menos una Historia.
- La acción principal permite descubrir y reproducir la Historia antes de entrar al editor.
- Los ejemplos demuestran comportamiento, no solo diagramas estáticos.
- El catálogo se reduce a ejemplos que enseñan de verdad qué hace Fluyo.
- «Compra online» es el candidato a ejemplo canónico.
- OAuth y Kafka son los ejemplos que se actualizan.

**Mientras dure la pausa no se implementa** EX-1, EX-2 ni EX-3, y no se tocan el código, CACHE ni los ejemplos. Tampoco hay commits.

**Al llegar I18N-002 a S7:** revisar esta auditoría contra el estado real del producto y decirle al PO qué decisiones hay que actualizar antes de implementar. Ya se sabe que habrá que revisar al menos esto (sin reauditar ahora):

- **Números de CACHE.** §10 propone v108–v110, pero ya están ocupados: SHELL-001 publicó v108 e I18N-002 S0 usa v109. Las slices de EXAMPLES tomarán los números libres en su momento.
- **D10 (tema crema de la galería).** FLUYO-SHELL-001 ya llevó las páginas públicas al sistema visual del producto. Comprobar si D10 queda resuelta o se reduce a la galería.
- **D9 (I18N de los ejemplos)** frente a **D-EXAMPLES** y **D-PAGES** de I18N-002. Hay que decidir si los ejemplos tienen ediciones por idioma escritas a mano (como propone §10) o solo es/en, y en qué idiomas existe la galería (es/en, o también fr/ja/zh). También hay que alinear con el glosario de I18N-002 los textos de la interfaz de la galería: «Historia», «narrada», «▶ Ver».
- **Rutas.** I18N-002 S7 propone páginas hermanas `/en/…`, mientras que §10 asumía `examples/`. Hay que adoptar el esquema que fije S7.
- **El botón «Ejemplo».** Comprobar dónde vive después de SHELL-001 y de las slices de chrome de I18N-002, y que elija la edición del idioma activo al cargar.

---

## Implementación (28-10-2026)

Base `eb82cb1` (CACHE v115). Sin commit, push ni deploy. Sin cambios en el kernel, el formato, el motor, el Viewer ni el MCP.

**Regla de producto (PO):** todo ejemplo publicado tiene al menos una Historia funcional reproducible.

### Catálogo

| Ejemplo (slug) | Historias | Qué demuestra |
|---|---|---|
| Compra online (`compra-online`, nuevo; también el botón «Ejemplo») | «Compra con éxito» · «El banco no responde» | petición/respuesta por la misma conexión (`reverse`), espera de llegada real (el almacén se retiene ≈ 1 s hasta que llega el cobro), fallo real (`not_completed / target_down`) |
| Inicio de sesión OAuth 2.0 (`inicio-de-sesion-oauth2`, nuevo; el antiguo `oauth2-flujo-autenticacion` queda retirado e intacto) | «Iniciar sesión» · «El usuario no autoriza» | ida y vuelta, consentimiento, código → token, la llamada a la API espera al token; ruta alternativa narrada |
| Pedido asíncrono con cola (`pedido-asincrono-cola`, nuevo; sustituye a Kafka) | «Un pedido» · «Un mensaje que falla» | asincronía, concurrencia, servicios independientes, fallo de Pagos, DLQ |

- Ediciones `es` (`ejemplos/data/`) y `en` (`ejemplos/data/en/`), escritas a mano y con la misma estructura. Se elige la edición al cargar, según el idioma de la interfaz; fr/ja/zh reciben la española.
- Todos los pasos llevan frase (`message`), incluidos los de momentos simultáneos. Ritmo: 2,4 s por momento.
- Espera de llegada: el paso dependiente se pide 100 ms después del envío del que depende y el motor lo retiene hasta la llegada.
- Retirados de la galería, pero su `?ejemplo=` sigue cargando: OAuth antiguo, funnel, onboarding, cadena de suministro, Kafka, microservicios, ETL y serverless.

### Archivos

- `ejemplos/data/{compra-online,pedido-asincrono-cola}.fluyo.json` (nuevos), `ejemplos/data/inicio-de-sesion-oauth2.fluyo.json` (nuevo) y `ejemplos/data/en/*.fluyo.json` (3).
- `ejemplos/previews/{compra-online,pedido-asincrono-cola,inicio-de-sesion-oauth2}.svg`: exportador SVG real.
- `ejemplos/index.html`: tres tarjetas con qué es, «Aprenderás:» y un «▶ Historia» por Historia hacia el Viewer, con un enlace `#d=` precalculado del documento entero y esa Historia primero. Incluye una nota que distingue «fallo» de «ruta alternativa».
- `css/pages.css`: estilos de la lista de Historias.
- `js/examples.js`:
  - la lista blanca queda solo con slugs (1 = catálogo, 0 = retirado);
  - `EXAMPLE_EDITIONS`, `exampleDataUrl()` y `fetchExample()`;
  - `?ejemplo=` abre en modo Historias.
- `js/export.js`: «Ejemplo» carga `compra-online` (edición del idioma) como página nueva con `importPagesIn`, en modo Historias con la primera seleccionada (`showExampleStories`). Ya no hay funnel cableado.
- `js/analytics.js`: valores `compra-online` y `pedido-asincrono-cola`.
- `js/i18n-en-editor.js`: fuera las 14 claves del funnel; quedan `example.page` y `example.pageN`.
- `sw.js`: CACHE v116. `compra-online` (es y en) pasa a la lista obligatoria, para que funcione sin red, y el resto a la opcional.
- Tests:
  - `test/fluyo-examples-001.test.cjs` (vm; con `--write` regenera los enlaces de la galería);
  - `test/fluyo-examples-001-browser.cjs` (QA en Chrome real);
  - CACHE re-fijada en 86 tests;
  - adaptados al botón nuevo: `analytics`, `018-12`, `i18n-002-s1` y `s3a`;
  - línea base del trinquete reescrita (baja).

### Pruebas

- `node --test test/fluyo-examples-001.test.cjs`: **9/9**. Validez, outcomes esperados, espera de llegada efectiva, paridad es/en y enlaces sin deriva.
- `node test/fluyo-examples-001-browser.cjs`: **40/40**, sin errores de consola:
  - galería (3 × 2, previews, móvil 390);
  - las 6 Historias en el Viewer momento a momento, en es y con la interfaz en inglés;
  - una reproducción completa;
  - «Ejemplo» en es y en, sin tocar el documento existente;
  - `?ejemplo=` en es/en y un slug retirado;
  - «Ejemplo» sin red.

### Tests históricos (scope y corpus)

EXAMPLES rompía 56 tests históricos. Quedan resueltos con dos cambios estructurales, sin eliminar ni desactivar ninguno:

- **Razón A · nueva capa de scope/undo.**
  - `test/fluyo-examples-001-undo.cjs` (`undoEx`) deshace EXAMPLES hasta `eb82cb1`: piezas del diff con dos líneas de contexto y `NEW_FILES`.
  - Va al final de la cadena: `undoS3b` la llama primero, así que la cadena completa queda `undoI18n → … → undoS3a → undoS3b → undoEx`.
  - Se registra en el predicado «solo de capas posteriores» de cada alcance: `shellOnly` (`fluyo-shell-001-undo.cjs`, compartido por las familias SCENARIOS/MESSAGE/REVERSE/NARRATION), los tests de alcance de S0, S1, S2a, S2b, S3a, S3b y SHELL-001.
  - Su comprobación de `sw.js` («solo CACHE») pasa antes por `undoEx`.
- **Razón B · el corpus puede crecer.**
  - `test/corpus-historico.cjs` (`historicalExamples(root, rev)`) devuelve los `.json` de `ejemplos/data` que existían en el commit que se comprueba (`git ls-tree`; los 13 commits base tienen los mismos 8).
  - Lo usan los 13 tests de corpus de slices antiguas y cinco tests de navegador que comparan el corpus con su árbol base (019-4a, 019-d6, 019-1, 019-2 y semantics-5).
  - Los 6 documentos nuevos los cubren `test/fluyo-examples-001*.cjs`.
- **OAuth en slug nuevo** (`inicio-de-sesion-oauth2`): `oauth2-flujo-autenticacion` queda retirado e intacto byte a byte, así el corpus histórico no cambia.
- **Si se tocan los JSON o la galería:** regenerar los enlaces con `node test/fluyo-examples-001.test.cjs --write` y regenerar también las piezas de `fluyo-examples-001-undo.cjs`.

**Resultado** (suite completa en un clon desechable con EXAMPLES commiteado):

- 1774 tests, 83 fallos, los mismos nombres que `HEAD` (`eb82cb1`).
- 0 nuevos; 56/56 resueltos.

Varios alcances antiguos comparan con `HEAD` o listan archivos sin seguimiento, así que en el árbol sin commit siguen en rojo hasta el commit, como en las slices anteriores.

**Tests de navegador antiguos que leen `ejemplos/data`** (cierre, 28-10-2026):

- `fluyo-i18n-002-s0-browser`: 385 ✔ · 0 ✘, sin cambios (sus documentos nuevos se serializan igual en los cinco idiomas).
- `fluyo-019-1-browser`, `fluyo-019-2-browser` y `fluyo-scenarios-semantics-5-browser` fallaban porque cargaban los ejemplos nuevos en su árbol base, que no los tiene (`?ejemplo=` sin archivo) o no conoce `message` en los pasos (`invalid_document`): razón B, no regresión. Pasan a `historicalExamples`; quedan en 59 ✔, 85 ✔ y 85 ✔, 0 ✘.
- Tras el ajuste: `fluyo-examples-001` 9/9 y su QA en Chrome 40/40; suite del clon con EXAMPLES commiteado, 1774 / 83, los mismos de `HEAD`, 0 nuevos.
