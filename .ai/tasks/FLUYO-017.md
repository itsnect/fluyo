# FLUYO-017 — Product discovery / roadmap checkpoint

Estado: ANÁLISIS ENTREGADO — pendiente de decisión de producto; NO IMPLEMENTADO.
Fecha: 1 de octubre de 2026.
Alcance: auditoría del producto existente y alternativas de siguiente slice. Este documento no aprueba un desarrollo ni anuncia un roadmap.

## 1. Conclusión y recomendación

Fluyo ya completa un recorrido útil: **creo un sistema → defino su vocabulario de Eventos → compongo distintas Historias sobre él → reproduzco sus consecuencias → presento una → comparto esa Historia con alguien que puede reproducirla**. La continuidad entre autor y receptor es una fortaleza real: editor, Present y Viewer utilizan la misma receta de reproducción.

El siguiente salto no parece ser añadir efectos ni convertir Historias en un lenguaje de programación. Parece ser **hacer accesible el modelo que ya existe a un agente que pueda crear, revisar y modificar Historias ejecutables**. Hoy `fluyo-mcp` alcanza Structure, pero no ofrece autoría ni evaluación de Behavior + History. La distancia es de contrato y operaciones, antes que de un nuevo engine.

**Recomendación: investigar como dirección de FLUYO-017 la autoría completa de Historias mediante MCP**, limitada a un documento que entra y otro revisable que sale, con validación y resumen de consecuencias usando la semántica vigente. El experimento decisivo es crear el recorrido de pago y luego producir una segunda Historia con Kafka caído, sin reconstruir el diagrama ni cambiar el original.

Alternativas razonables: si la prioridad es el usuario que trabaja manualmente en el editor, investigar lectura/comparación de dos Historias; si se quiere validar la conexión con sistemas reales antes que la asistencia de autoría, investigar una sola traza exportada convertida en Historia revisable. Ambas se detallan en §9. No hay evidencia de usuarios en esta auditoría que permita declarar una prioridad comercial entre esas alternativas.

## 2. Método, evidencia y límites

### Contexto leído antes de escribir

- `AGENTS.md`, `.ai/PRODUCT.md`, `.ai/ARCHITECTURE.md`, `.ai/DECISIONS.md`.
- `.ai/tasks/FLUYO-015.md` y `.ai/tasks/FLUYO-016.md`, incluidos QA y 016.1.
- Repo hermano `../fluyo-mcp`: `README.md`, registro de tools, modelos, operaciones de diagrama, enlaces y tests de contrato. La petición autoriza explícitamente esta revisión del repo hermano.
- Estructura actual del repo y búsquedas dirigidas en modelo, engine, playback, render, autoría, selección/undo, exportación, Present, Share y Viewer.

### Estado realmente auditado

- Editor: HEAD `c4a60e8` (`feat: evolve scenarios into stories`), formato de documento v5, engine v2 compatible con v1, SW `fluyo-static-v60`.
- MCP: HEAD `d8df96b`, paquete 1.0.0; crea documentos v3, que el editor puede migrar.
- Ambos árboles estaban limpios al comenzar. El texto de 016 dice «sin commit» y la petición lo describe listo para commit, pero el checkout ya tiene el commit citado. Se registra la discrepancia; esta auditoría no creó commits ni infiere nada sobre push o despliegue.
- No existe un roadmap futuro explícito en los documentos de contexto leídos. Se contrastan la visión pública, las decisiones y la secuencia 015–016 con las direcciones solicitadas; no se asume un backlog adicional.

### Verificación realizada en esta auditoría

- Chrome real: `test/fluyo-016-browser.cjs`, **17 bloques OK**. Cubre panel, independencia de Historias, undo/redo de sus operaciones, reproducción, Present, Share→Viewer, legacy, responsive y Viewer offline. No es un estudio de usabilidad.
- `node --test test/fluyo-016.test.cjs test/fluyo-015.test.cjs`: **74/74 OK**. No se vuelve a atribuir a esta sesión la suite completa ni las mutaciones del handoff anterior.
- Exploración adicional en Chrome sobre una sesión temporal: Cliente→Kafka→Comercio, dos Historias, modal de Evento, reproducción normal y con caída, Present y diálogo de Share. **0 errores de página**.
- Comprobación adicional: editar el nombre de un Evento y hacer Undo; preservar Eventos/Historias mediante una edición no destructiva en MCP; borrar una conexión mediante MCP y validar después con el engine del editor. Resultados en §5 y §7.
- Fuentes oficiales externas para evaluar el alcance de integraciones; enlaces en §6. Son contexto de viabilidad, no evidencia de integraciones implementadas.

Capturas y resultados temporales, fuera del repo: `C:/Users/nectd/AppData/Local/Temp/fluyo-017-audit/`. Incluyen `06-canvas-timeline.png`, `07-event-editor.png`, `09-present-playing.png`, `10-failure-playback.png`, `11-share-dialog.png`, Viewer y panel móvil de la suite, y `audit-results.json`. Estos archivos no son entregables versionados ni deben ser necesarios para comprender este documento.

Las valoraciones visuales se basan en esas pantallas y su comportamiento local; las preferencias de usuarios y la adopción de integraciones siguen siendo hipótesis. No se verificó el despliegue público, no se conectó un sistema real y no se utilizó un modelo para medir éxito de autoría MCP.

### Trazabilidad de los hallazgos principales

Rutas relativas al repo `fluyo/`; números de línea del snapshot auditado, como ayuda de revisión:

| Afirmación | Evidencia local |
|---|---|
| Documento v5, Eventos de proyecto y Historias por página | `js/model.js`, `serializeProject`, `blankPage`, fábricas de Evento/Scenario; `.ai/ARCHITECTURE.md`. |
| Disponibilidad de página, resultado inmediato y pasos independientes | `js/scenario-engine.js:122` (`buildInitialStates`) y `:142` (`runScenario`). |
| Una receta de reproducción y presentación separada de Trace | `js/story-playback.js:64` (`start`), `stepMeta`; `js/scenario-playback.js`, `makePlayback`/`tick`. |
| B1: Undo excluye EventTypes | `js/selection.js:117` (`snapPage`) y `js/editor-scenarios.js:1917` (`scSaveEventType`); QA de 015; reproducción adicional. |
| Export GIF no reproduce una Historia | `js/export.js:468` (`exportGIF`) y `js/render.js:950` (rama export de `render`). |
| Share seleccionado, bloqueo de reproducción y Viewer sin selector | `js/share-url.js:34` (`applyShareKind`), `js/editor-share.js:15` (`showShareDialog`), `js/viewer.js:128` (`storyScenario`). |
| MCP crea v3 y sólo expone operaciones estructurales | `../fluyo-mcp/src/diagram.ts:220`, `../fluyo-mcp/src/model.ts:358`, `../fluyo-mcp/src/server.ts`. |
| MCP preserva sin validar semántica de Historias; B2 | `../fluyo-mcp/src/model.ts:117` y `:126` (passthrough); `../fluyo-mcp/src/diagram.ts:327`/`:353` (borrados); fixtures/contrato y reproducción adicional. |

## 3. Estado actual: qué puede hacer un usuario

### Recorrido completo

1. **Dibujar la estructura.** Crear páginas, elementos con formas, iconos, imágenes, GIFs o código; conectarlos y ajustar su posición, etiquetas, apariencia y rutas. Guardar localmente, recuperar la sesión o abrir un documento/enlace.
2. **Definir qué ocurre.** Crear Eventos reutilizables con nombre, frase y símbolo: algo viaja por una conexión, algo ocurre en un elemento o un elemento deja/vuelve a responder. Los controles visuales permiten comunicarlo sin escribir primitivas del motor.
3. **Construir una Historia.** Colocar Eventos en el sistema por arrastre o clic; ordenarlos en una línea temporal, cambiar las esperas, duplicar apariciones y agrupar acontecimientos simultáneos. Una aparición tiene un objetivo y un momento; el Evento de biblioteca sigue siendo compartido.
4. **Probar alternativas.** Crear, nombrar, duplicar, seleccionar y eliminar distintas Historias sobre la misma página. El camino normal y una caída pueden coexistir sin duplicar la estructura.
5. **Reproducir.** Ver qué viaja, qué ocurre y qué envíos no se completan cuando un extremo no está disponible. Detener, volver a editar y repetir. El orden narrativo coincide con los pasos persistidos y con la resolución del motor.
6. **Presentar.** Mostrar la Historia seleccionada sobre un canvas despejado, con progreso y texto de consecuencias; usar páginas como diapositivas.
7. **Compartir.** Generar una copia autocontenida con la Historia seleccionada o sólo el diagrama. El receptor abre un Viewer, reproduce y puede abrir la copia en Fluyo para editarla.

**Cómo se siente el loop:** completo para explicar una secuencia concreta, enseñarla y entregarla. Todavía menos completo para investigar por qué ocurre, comparar dos explicaciones o contrastar una explicación con evidencia de un sistema real. Su fortaleza está en la autoría y entrega de una narración ejecutable, no en descubrir automáticamente el sistema.

### Límites que importan al usarlo

- Las Historias son independientes en sus pasos, **no en todo su contexto**: comparten nodos, conexiones, EventTypes y condiciones iniciales de página. Editar un Evento cambia todos sus usos. Cambiar las condiciones iniciales afecta a todas las Historias de esa página.
- Para que sólo una Historia empiece con Kafka caído, hoy conviene colocar su caída como primer acontecimiento de esa Historia, antes del envío. No modificar la disponibilidad inicial de la página pensando que pertenece sólo a la Historia activa.
- Compartir una Historia excluye las otras, también las de otras páginas. Las otras páginas y el vocabulario completo de EventTypes siguen viajando. El enlace es un snapshot; no sincroniza ediciones posteriores.
- Exportar GIF anima el diagrama base; **no exporta la reproducción de la Historia**. `exportGIF` genera frames con `makeReadOnlyRenderState`, y la rama export de `render` no pinta overlays de Historia. PNG/JPG/SVG tampoco capturan ese recorrido como una secuencia. Es un product gap, no una nueva regresión de 016.
- Existe Pausa/Play para la animación general del diagrama; no una pausa de la Historia. El reloj de Historia usa `performance.now()` por separado. No hay navegación por momentos, scrub ni comparación de ejecuciones en la UI actual.
- Guardado/autosave y compatibilidad están presentes, pero Undo no abarca los EventTypes del proyecto (§5). No describir la reversibilidad como universal.

## 4. Modelo de producto: potencia real y frontera

```text
Structure: elementos y relaciones de una página
    ↓ proporciona objetivos
Behavior: disponibilidad inicial de página + cambios explícitos de estado
    ↓ condiciona el resultado de los envíos
History: apariciones ordenadas de Eventos sobre esa estructura
    ↓ engine determinista → Trace de resultados
Playback: proyección temporal y visual del Trace + vocabulario
    ↓ misma receta y pintor
Present / Share → Viewer

MCP hoy ─────────────────→ Structure / documento / enlace al editor
MCP posible ─────────────→ autoría y consulta de Structure + Behavior + History
Fuentes externas posibles → evidencias → mapeo revisado → estructura / Historia
IA posible ──────────────→ propuesta del modelo y sus Historias, con validación
```

No son cinco colecciones nuevas ni capas de schema a diseñar. Structure corresponde a nodos/conexiones; el Behavior existente es acotado, principalmente disponibilidad UP/DOWN; History sigue siendo `page.scenarios[]`. Los EventTypes, en `doc.eventTypes`, conectan el lenguaje humano y la presentación con las tres primitivas existentes. No contienen un programa de procesamiento para cada servicio.

**Qué hace más útil una Historia que una animación:** sus acontecimientos tienen objetivo, orden e identidad; se pueden editar y reutilizar; la disponibilidad altera resultados; esos resultados quedan en un Trace determinista; la misma Historia viaja al receptor. Dos variantes pueden ejecutarse sobre la misma estructura. Un video sólo conservaría sus fotogramas.

**Qué hace más útil el diagrama que una imagen:** sus elementos son referencias de acontecimientos y estados, no sólo figuras. Mantener una estructura común permite cambiar la explicación sin redibujarla. La oportunidad es que esas referencias también puedan vincularse a componentes y observaciones externas.

### Semántica verificada: no confundir con una simulación de sistema

- `SEND` emite inicio y resultado **en el mismo instante virtual**. El resultado se decide por UP/DOWN de origen y destino en ese momento.
- El viaje de 500/1100/1800 ms pertenece a Playback. Su final visual no dispara el siguiente paso, ni representa latencia real. Suave/Impulso modifican el recorrido visible, no los tiempos del Trace.
- Los pasos posteriores son explícitos y se ejecutan aunque un envío anterior falle. No hay procesamiento automático de mensajes, colas, propagación de fallos, variables, payloads, guards ni dependencia causal entre pasos.
- A igual `at`, el orden del array resuelve empates. «Kafka cae» antes de «enviar a Kafka» produce un resultado distinto del orden inverso, aunque se vean «al mismo tiempo».
- `OCCURRENCE` registra que algo ocurre; no deduce una consecuencia de negocio. Un rombo dibujado tampoco introduce una decisión ejecutable.
- Límites del engine: 1.000 pasos por Historia, 2.000 eventos de Trace y tiempo virtual máximo de 24 horas. Una importación de observaciones debe resumir, no volcar un stream ilimitado.

En el experimento de pago, la Historia normal produce dos envíos completados. La copia con caída de Kafka antes del primer envío produce `target_down` al entrar y `source_down` al intentar confirmar. La confirmación sigue siendo intentada: **el motor demuestra disponibilidad, no infiere toda la lógica de Kafka ni del pago**.

## 5. Revisión con ojos de usuario

Leyenda: **Bug** = resultado incorrecto o pérdida de una operación esperada; **UX polish** = la capacidad funciona pero cuesta descubrirla o leerla; **Product gap** = falta capacidad; **Futuro** = dirección posible que no corresponde añadir por defecto. Los juicios de claridad son hipótesis cualitativas, no resultados de entrevistas.

| Área | Lo que funciona y cómo se percibe | Clasificación y oportunidad |
|---|---|---|
| Canvas | Colocar sobre conexiones/elementos tiene sentido espacial. Las rutas dan contexto al viaje. En escritorio hay toolbar de dibujo, ajustes globales y panel de Historia compitiendo por atención; la cabecera ya ocupa dos filas a 1366×768. | **UX polish:** jerarquía de tareas y separación perceptible entre dibujo y narración. **Product gap:** ausencia de vínculos verificables a entidades externas. **Futuro:** múltiples niveles de detalle de un sistema grande; no deducir capacidad de escala de una prueba de 150 pasos. |
| Biblioteca de Eventos | Nombre+símbolo hace un vocabulario propio. El arrastre está explicado y existe colocación sin arrastrar. La lista pone «Caída», «Confirmación» y «Pago» al mismo nivel aunque unos cambien disponibilidad y otros sólo viajen. | **UX polish:** ayudar a reconocer dónde se coloca cada Evento y qué consecuencia tiene sin exponer primitivas. En móvil la biblioteca se compacta a «Eventos · N» y necesita abrirse; funciona, pero reduce descubrimiento. No añadir un marketplace como respuesta. |
| Editor de Evento | Modal amplio, frases con nombres insertables, preview y revelación progresiva. Se comunica el alcance global y el bloqueo de comportamiento cuando está en uso. En la captura, dos avisos y varios grupos consumen gran parte del cuerpo; «Cómo viaja» queda más abajo. | **UX polish:** acortar el recorrido inicial y probar nombres con usuarios. El preview Cliente→Comercio puede resultar artificial al editar un Evento sobre Kafka; es ilustrativo, no el objetivo real. **Bug B1:** Undo no restaura el Evento editado. |
| Historias | Selector, creación inmediata y duplicado habilitan variantes sin redibujar. El nombre activo está claro. | **UX polish:** al volver de otra página se selecciona la primera, no la última usada; decisión vigente, no bug. **Product gap:** leer diferencias/resultados de dos Historias sin recordar manualmente ambas. **Product gap:** contextos iniciales independientes por Historia, sólo si los casos lo demandan; hoy son de página. |
| Timeline | Frases y esperas se leen como relato. El estado de reproducción ocurre sobre la misma lista. La simultaneidad muestra que el orden puede afectar al resultado. | **UX polish:** menús profundos para operaciones frecuentes, unidades «800 ms» frente a «2.4 s», y cantidad de texto secundaria pequeña. **Product gap:** sacar libremente un miembro de un grupo simultáneo a un momento nuevo por arrastre; el modelo actual no inventa ese instante. No reportarlo como DnD roto. |
| Playback | Símbolos/cues y consecuencias hacen visible la ejecución. El editor reduce herramientas durante reproducción y deja volver a editar. | **Product gap:** pausa real, avanzar por momento e inspección de por qué se completó/falló un envío. **UX polish:** el Play/Pausa global y «Reproducir Historia» sugieren una unidad que sus relojes no tienen. **Product gap:** la narración no distingue aún dependencia causal de simple orden temporal. |
| Present | Amplía el sistema y retira el editor; progreso y consecuencias usan la misma ejecución. | **UX polish:** los puntos resumen progreso pero no explican por sí solos una Historia larga; en reproducción los controles se atenúan. **Product gap:** detenerse en un momento para explicar y retomar. La grilla permanece visible si estaba activada; valorar con usuarios, no llamarlo fallo. |
| Share | Elección clara entre Historia y diagrama, nombre de Historia y aviso de copia/enlace público. Reproduce lo elegido sin mutar el original. | **UX polish:** no explicita que excluye Historias de otras páginas, pero incluye el resto del diagrama y toda la biblioteca. Bloquear Share en reproducción/completado es decisión 68 y su mensaje existe: fricción a medir, no bug. **Product gap:** no puede compartirse una comparación como tal. |
| Viewer | Lectura limpia, reproducción/repetición y «Abrir en Fluyo»; no exige cuenta. El sistema ocupa el centro y la Historia aparece debajo. | **UX polish:** al terminar, el título principal puede ser el último Evento y el nombre de Historia queda en una etiqueta más discreta. **Product gap:** explicar un resultado en detalle o explorar momentos. Ausencia de selector de Historias es deliberada, no un defecto de 016. |

### Bugs confirmados, sin corregir

**B1 — Undo de edición de Evento no restaura el vocabulario.** Reproducción adicional: abrir «Pago», cambiar nombre a «Pago revisado», guardar, hacer Undo. El nombre queda «Pago revisado». `scSaveEventType` llama a `pushUndo`, pero `snapPage` sólo captura la página; `doc.eventTypes` queda fuera. El QA de 015 ya documentaba esta limitación. Es una falla de reversibilidad frente a la expectativa de editar/deshacer, no una razón para reabrir 016 con nuevas capacidades. La corrección futura requiere considerar alcance de proyecto y contadores, no sólo el texto del botón.

**B2 — MCP puede devolver una edición estructural que rompe Historias preservadas.** Sobre el documento v5 del experimento, `editDiagram(remove_edge)` devuelve éxito, conserva dos pasos apuntando a la conexión eliminada y el engine rechaza la Historia por `missing_edge`. Se reprodujo con el artefacto local `dist/diagram.js`; el caso está también directamente respaldado por las ramas `remove_edge`/`remove_node` de `src/diagram.ts`, que sólo actualizan estructura. `remove_node` presenta el mismo riesgo de referencias a nodos, conexiones y behaviors; esa variante no se ejecutó en esta auditoría. Preservar campos desconocidos no asegura integridad entre entidades.

No se detectaron nuevas fallas bloqueantes de 016 en el browser smoke. Estos dos hallazgos quedan documentados para mantenimiento; no se cambió código y no se creó otra tarea.

## 6. Oportunidades agrupadas

### A. Storytelling: legibilidad y continuidad antes que ornamentación

La base ya cubre tamaño, tres formas de movimiento, rastro, llegada, halo/respiración y efectos/mensajes sobre nodos. La estructura admite rutas rectas y ortogonales con waypoints. No faltan todos los efectos enumerados en la petición; varias capacidades ya existen y hay que separar qué significado aportan.

| Objeto / necesidad | Lo que ya sirve | Valor adicional posible | Lo que sería principalmente decoración |
|---|---|---|---|
| 🚚 Camión / ✈️ avión | Símbolo viajando, tamaño, recorrido de la conexión, rastro y llegada. | Orientación legible respecto al sentido del viaje; evitar un vehículo mirando hacia atrás. Para avión, trayectoria curva sólo si aclara el recorrido que el usuario necesita explicar. | Motor de física, aceleración configurable, vuelo 3D, humo y vibración generalizados. |
| 👤 Persona | Aparición en un nodo y traslado como FLOW. | Distinguir «una persona se desplazó» de «se envió una solicitud»; continuidad de identidad si la Historia sigue al mismo actor entre varios lugares. | Caminar animado o balanceo sin cambiar comprensión. |
| 📦 Paquete | Tránsito y llegada; una misma biblioteca en diferentes Historias. | Identificar el mismo paquete en varios tramos y su estado («preparado», «enviado», «entregado»). | Rotación o rebote adicional a los ya disponibles. |
| 💵 Dinero | Pago viaja con símbolo, frase y feedback de disponibilidad. | Mostrar importe, autorización/rechazo o relación con una transacción concreta cuando el caso lo exija. Requiere datos semánticos, no un efecto de brillo. | Multiplicar billetes/partículas para insinuar cantidad que el modelo no conoce. |
| ⚡ Señal | Símbolo pequeño, movimiento rápido y rastro. | Dirección inequívoca, reconocer petición frente a respuesta y resultado de envío. | Más halos o explosiones sin diferencia de resultado. |

**Dirección tiene dos problemas distintos:** el sentido lógico del envío es `edge.from→edge.to`, y la orientación visual de un glifo es otra cosa. `flowDir` invierte/alterna puntos de la animación base, pero no convierte un SEND en una respuesta inversa. La orientación del símbolo podría ser presentación; una operación de respuesta con origen/destino invertidos implica semántica y referencias. No mezclarlos en un control.

Rotar emojis indiscriminadamente puede empeorar lectura: un avión diagonal, una persona y un texto no comparten orientación natural. Antes de desarrollar, comparar unos pocos glifos y un preset optativo; no introducir animaciones por dominio. Entrada/salida visual puede servir para comunicar aparición, pero crear/destruir un objeto persistente es otro modelo.

**Dependencias:** orientación/legibilidad reutiliza geometría y pintor compartido; identidad persistente, atributos, importe y estado de objetos requieren una representación explícita que hoy no existe. No prometer seguimiento de un paquete por reutilizar el mismo emoji. El rastro ya existe, Suave/Impulso ya expresa aceleración aparente y tamaño/llegada ya están resueltos. No ampliar 015 con más knobs sin un relato que hoy no se pueda entender.

### B. Historias más expresivas: alternativas antes que programación

| Capacidad | Evaluación de producto | Dependencia / momento |
|---|---|---|
| Escenarios de fallo y recuperación | Valor inmediato para explicar disponibilidad y consecuencias. Ya se construyen con caída/recuperación y envíos explícitos. | Mejor autoría por MCP o mejores ejemplos/lectura; no exige engine nuevo para ese alcance. |
| Comparación de dos Historias | Valor alto: mostrar qué cambia y qué resultado produce sobre el mismo sistema. Aprovecha directamente 016. | Derivar resultados y diferencias con referencias y orden correctos; no necesita ramas ni ejecución doble simultánea inicialmente. |
| Concurrencia | La simultaneidad ya cubre narración paralela explícita. No equivale a operaciones con duración causal ni join. | Fork/join real necesitaría dependencias y finalización semántica; diferir hasta un caso donde la simultaneidad no alcance. |
| Alternativas y decisiones | Elegir dos Historias cubre dos caminos explicativos. Una decisión automática dentro de una Historia sólo agrega valor si el usuario necesita que cambie por una condición verificable. | Definir qué datos se consultan, alcance, reglas y lectura humana antes de guards/ramas. No basta dibujar un rombo. |
| Repetición y reintentos | Un relato con dos o tres intentos se puede escribir hoy. Facilitar su autoría puede bastar. | Un loop ejecutable requiere límites y semántica de terminación; un retry causal requiere saber qué envío falló y cuándo. Diferir. |
| Excepciones, timeout y fallback | Casos útiles, pero «no disponible» no representa todos los errores. OCCURRENCE puede narrar un rechazo, sin hacerlo resultado semántico del SEND. | Precisar resultado/error, dependencia causal y tiempos reales antes de extender el engine. No falsificar una caída para obtener un fallo visual. |
| Aserciones de resultado | «¿En esta variante llegó la confirmación?» aporta revisión verificable. El Trace actual permite preguntas sobre disponibilidad/envíos. | Consulta derivada primero; assertions persistidas o validación de lógica de negocio después. Un envío completado no prueba que el pago fue correcto. |

**Decisión propuesta:** sí merecen investigación comparación y lectura de consecuencias; fallos ya merecen uso del modelo existente. No hay fundamento suficiente para implementar ahora condiciones arbitrarias, variables, ramas, bucles o excepciones generales. La capacidad ausente de mayor importancia conceptual es **causalidad**, no un catálogo de instrucciones.

### C. Runtime e integraciones: cinco operaciones diferentes

1. **Importación:** leer una fuente una vez y producir un documento/propuesta revisable.
2. **Sincronización:** volver a leerla manteniendo identidad, layout, vocabulario y modificaciones manuales; requiere reconciliación y conflictos.
3. **Observación runtime:** convertir lo que ocurrió en acontecimientos con evidencia, tiempo y límites; no cambia el sistema real.
4. **Modificación:** ejecutar una escritura sobre el sistema real. Queda fuera de esta dirección de producto; editar el modelo de Fluyo no implica desplegarlo.
5. **Generación mediante IA:** inferir una propuesta desde fuentes. No es importación fiel ni observación; debe distinguir evidencia de hipótesis.

| Fuente | Importación | Sincronización | Observación runtime | Modificación | IA / encaje natural |
|---|---|---|---|---|---|
| OpenAPI | Operaciones, interfaces y contratos HTTP. Útil como entrada acotada, no inventario completo de un sistema. | Diff por identidad de operación/contrato y revisión de cambios; requiere resolver referencias y conservar decisiones del autor. | La especificación no dice qué petición ocurrió. Necesita trazas/logs. | No invocar APIs desde el reproductor. | Proponer un recorrido cliente→API con supuestos visibles. No inferir microservicios, Kafka o dependencias internas sólo por endpoints. |
| GitHub / código | Leer archivos de un commit, manifiestos y documentación; extraer relaciones seleccionadas. GitHub es la fuente, no el modelo del sistema. | Reanalizar por revisión y presentar diff; no redibujar todo ante cada commit. | Código/PR no prueba qué se ejecutó. | No editar repositorios ni crear despliegues como parte de Playback. | Potente si adjunta archivo/símbolo/revisión a cada inferencia y admite desconocidos. Primer alcance: un flujo, no «todo el repo». |
| Kubernetes | Snapshot de workloads/services y relaciones de despliegue. | Requiere identidades, versiones, filtrado y recuperación del watch. | Estado de recursos/eventos; no reconstruye por sí solo una transacción de negocio. | Aplicar manifests, escalar o reiniciar no encaja. | Contextualizar dónde corren servicios; riesgo alto de terminar como administrador de clúster. Preferir export local resumido. |
| Terraform | Configuración y JSON de plan/state para estructura de recursos/dependencias. | Reconciliar recursos y cambios deseados/observados con layout manual. | Plan/state no es flujo de solicitudes ni traza. | `apply`/destroy queda fuera. | Explicar estructura declarada y sus límites, no asumir comportamiento real. Filtrar datos sensibles antes de derivar el documento. |
| Kafka | Topología declarada de productores/topics/consumidores si la fuente la aporta. | Nombres/identidades y cambios de topología seleccionados. | Métricas/lag y registros correlacionados son fuentes distintas. Un mensaje aislado no contiene la historia completa entre servicios. | Publicar/consumir para cambiar offsets o administrar topics no encaja. | Explicar un recorrido de mensajes. Mejor evidencia correlacionada a través de trazas que un conector directo al broker como primer paso. |
| OpenTelemetry | Importar una traza exportada y mapear servicios/operaciones relevantes. | Actualizar mapping servicio→elemento; no confundirlo con streaming continuo. | Es la entrada más natural para «esto ocurrió así»: spans, tiempos, relaciones y links asíncronos cuando estén presentes. | No necesita escritura sobre producción. | Resumir un recorrido observado y ayudar a narrarlo. Debe conservar límites de la instrumentación y del engine de Fluyo. |
| Logs / traces heterogéneos | Archivo acotado con formato conocido. | Parsers/versiones y mapping estable si se repite. | Sin correlación y origen/timestamps fiables, sólo hechos sueltos; ausencia de un log no demuestra ausencia del acontecimiento. | Ninguna como objetivo. | Útiles para anotar una Historia; riesgo alto de causalidad inventada si se intenta reconstruir todo desde texto libre. |
| MCP | Recibir documentos y datos de otro agente/conector autorizado. | Puede orquestar una actualización, pero no aporta por sí solo identidad, almacenamiento ni conflictos. | Puede transportar observaciones; el protocolo no es una fuente de telemetría. | Modificar el documento sí encaja; actuar sobre sistemas externos no es necesario. | Encaje inmediato como puerta al modelo completo de Fluyo. Puede evitar construir primero conectores nativos para cada plataforma. |

**Integración con mejor encaje:** importar **una traza exportada, revisada y reducida** para contar una Historia sobre el sistema. Aporta History y evidencia, no sólo más nodos. **Entrada estructural de menor alcance:** un contrato OpenAPI, si se quiere resolver primero dibujar una interfaz. Las dos responden a necesidades diferentes; no tratarlas como intercambiables.

Fuentes oficiales consultadas el 01-10-2026:

- [OpenAPI Specification](https://spec.openapis.org/oas/v3.2.1.html): describe interfaces HTTP y operaciones; no observaciones de ejecución.
- [GitHub: repository contents](https://docs.github.com/en/rest/repos/contents): acceso a contenido por referencia del repositorio; la extracción del sistema debe construirla otra capa.
- [Kubernetes API concepts](https://kubernetes.io/docs/reference/using-api/api-concepts/): recursos/versiones y mecanismo list/watch; sincronizar no es un fetch único.
- [Terraform show](https://developer.hashicorp.com/terraform/cli/commands/show): JSON de plan/state; valores sensibles pueden aparecer en claro. Es una dependencia concreta de esa entrada, no una advertencia genérica del editor.
- [Kafka monitoring](https://kafka.apache.org/41/operations/monitoring/): métricas de brokers/clientes; no equivalen a reconstrucción causal de pagos.
- [OpenTelemetry traces](https://opentelemetry.io/docs/concepts/signals/traces/): spans, timestamps, atributos, estado y links, incluidas relaciones asíncronas.

Las columnas de encaje y momento son inferencias de producto sobre esas fuentes y el código local, no capacidades prometidas por los proveedores.

### D. Dependencias del paso a runtime

No implementar un «System Graph» aparte por el nombre. Antes tendría que existir:

- **Identidad externa y granularidad:** servicio/operación/topic/recurso, entorno y revisión mapeados a referencias de página. Los ids locales de Scenario/Step no son globales; las keys temporales de MCP tampoco son identidades persistentes.
- **Procedencia:** qué relación fue observada, declarada, inferida o añadida por el autor; fuente, revisión/ventana de captura y alcance. Un archivo o artefacto adjunto podría servir en investigación; persistirlo en Fluyo necesita decisión posterior de formato.
- **Selección y reducción:** pocos componentes y momentos relevantes para una explicación. No un nodo por span ni una Historia por log.
- **Mapping temporal:** tiempo observado, orden narrativo y duración visual separados. Reordenar/colapsar esperas en Timeline hoy modifica `at`; no debe destruir la evidencia original de una captura.
- **Semántica de resultados:** error de span o HTTP 500 no implica servicio DOWN. La v2 no modela todos los resultados reales; anotar un error como ocurrencia es más honesto que declarar una caída ficticia.
- **Revisión antes de reemplazo:** imports generan propuestas; sincronización posterior necesita reconciliación que preserve layout y vocabulario, con conflictos visibles.
- **Transporte acotado:** una captura finita que pueda conservarse localmente y compartirse. Streaming y conectores autenticados añaden otra clase de complejidad; no son necesarios para probar el valor.

## 7. Auditoría de MCP / agentes

### Capacidades reales

Las nueve tools registradas son `create_diagram`, `edit_diagram`, `export_diagram`, `list_icons`, `list_colors`, `list_anims`, `list_fonts`, `list_templates` y `create_from_template`. Hay stdio y HTTP stateless. Generan/devuelven documentos, catálogos, SVG estático y enlaces al **editor** `/#d=`, no al Viewer de una Historia seleccionada.

`CreateDiagramInputShape` y `OperationSchema` exponen nodos/conexiones/estilo/layout; no EventTypes, behaviors, Scenarios ni Steps. Las plantillas son de estructura. Los modelos usan `passthrough`, por lo que datos modernos pueden sobrevivir aunque MCP no los interprete. Se verificó que actualizar una etiqueta preserva Eventos y las dos Historias del documento v5 del experimento.

**Preservación no es comprensión ni validación semántica:** `FluyoProjectSchema` no declara las entidades de Historia/Evento; no ejecuta su engine ni valida sus referencias. Los ocho fixtures del contrato no contienen `eventTypes`, `behaviors` ni `scenarios`. La promesa de roundtrip del README está probada sobre esos ejemplos, no sobre todo el modelo nuevo. El bug B2 es la consecuencia concreta.

`createDiagram` sigue emitiendo v3. Eso no impide abrir su estructura en el editor, pero no constituye autoría actual de v5. Tampoco existe conexión con la sesión viva del navegador: el agente recibe un documento y devuelve una copia. La sesión stdio no convierte las funciones puras en edición en vivo.

### Distancia a las dos peticiones de lenguaje natural

**«Crea una Historia donde el cliente paga, Kafka procesa el evento y el comercio recibe la confirmación.»**

- Hoy: puede crear Cliente, Kafka y Comercio con conexiones y puntos animados; no crear formalmente esa Historia a través de las tools publicadas.
- Con operaciones sobre el modelo existente: definir Pago como FLOW, Procesamiento como OCCURRENCE y Confirmación como FLOW; crear una Historia con objetivos y momentos. «Procesa» sería un acontecimiento escrito por el autor/agente, no una ejecución real del broker.
- Un modelo podría fabricar JSON de Historia por fuera y reenviarlo aprovechando passthrough, pero no sería una API guiada, validada y verificable. No contar esa posibilidad como soporte MCP.

**«Modifica la Historia para mostrar qué ocurre cuando Kafka está caído.»**

- Alcance que ya admite el engine: duplicar la Historia, insertar «Kafka deja de responder» antes del primer envío y revisar resultados de entrada/salida. Conservar la original.
- No cambiar las condiciones iniciales de toda la página para una sola variante sin explicar el alcance.
- Si «qué ocurre» incluye reintento, cola, devolución, timeout o notificación alternativa, los acontecimientos deben escribirse explícitamente o declararse como hipótesis. El engine no los infiere ni condiciona automáticamente a la falla.

### Capacidades faltantes para autoría fiable

| Necesidad | Mínimo a investigar | Qué reutilizar |
|---|---|---|
| Comprender el documento | Resumen de páginas, nodos/conexiones, Eventos y Historias, con ids contextualizados; descubrimiento de capacidades/versiones. | Documento y nombres actuales; evitar reenviar todo para una pregunta simple. |
| Crear/editar Behavior | Disponibilidad con alcance explícito; distinguir cambio de estado en una Historia de inicialización de página. | UP/DOWN y primitivas vigentes. |
| Crear/editar vocabulario | Operaciones guiadas de Evento, validación de frases/símbolos y aviso de usos globales; proteger primitiva en uso y eliminación referenciada. | Normalizadores y reglas de `model.js`; no copiar una segunda semántica. |
| Crear/editar Historia | Crear, duplicar, nombrar; insertar/quitar/reordenar apariciones, esperas y simultaneidad con objetivos válidos. | Fábricas y funciones `storyboard*`; refs por página/Historia y contadores irreutilizables. |
| Revisar consecuencias | Validar y ejecutar con el mismo engine; devolver resultados y razones humanas por aparición, sin DOM. | Engine puro y traducción ya existente; no pedir que el LLM «simule» UP/DOWN. |
| Edición segura | Operación/batch atómico sobre copia; rechazar o explicar referencias afectadas por borrado; tratar versiones no soportadas sin reinterpretarlas. | Modelo y contrato de documento; resolver B2 antes de prometer autoría completa. |
| Entregar para revisión | Documento abrible y enlace; descripción de qué Historia cambió y qué resultado tiene. Selección explícita del resultado a revisar. | Codec/enlace al editor. No hace falta modificar Share/Viewer para el primer experimento. |

Un inspector compacto, patches con revisión y resultados estructurados ayudarían al contexto del agente, pero no requieren abrir ahora almacenamiento remoto, sesiones con cuentas ni un canal de edición en vivo. El límite HTTP vigente de 1 MB de entrada/200 KB de resultado y el enlace MCP de 16.000 caracteres no son el mismo límite que Share (65.536); probar documentos finitos y explicar fallback a archivo.

**Dependencia principal:** un contrato de dominio compartido o verificado mecánicamente para autoría y validación. Evaluar cómo adaptar los scripts puros que hoy usan globales al servidor; no asumir que basta con importar `model.js` como módulo ni que haya que migrar toda la app a un build. La investigación debe elegir una vía de reutilización, no implementar un segundo engine TypeScript.

## 8. IA / comprensión de sistemas

La dirección ambiciosa tiene encaje, pero el paso ausente no es «añadir IA al canvas». Es producir un modelo verificable del sistema y traducirlo sin inventar semántica.

```text
Código / contratos / configuración en una revisión concreta
    ↓ extracción acotada + referencias a evidencia
Modelo intermedio del sistema
    componentes, relaciones, operaciones, supuestos y desconocidos
    ↓ reducción a una pregunta / recorrido
Propuesta de Structure + Behavior + History
    ↓ validación del modelo y ejecución determinista
Fluyo → revisión humana → Playback / Present / Share

Runtime en una ventana concreta
    ↓ observaciones correlacionadas + límites de captura
Evidencias vinculadas al modelo intermedio
    ↓ diferencias propuestas, sin sustituir intención por observación
Modelo revisado → propuesta de actualización de Fluyo
```

### Piezas intermedias necesarias

1. **Adquisición de fuentes con alcance.** Qué archivos, revisión y entorno se analizan. Un repo no contiene necesariamente servicios externos, configuración dinámica ni todo el recorrido.
2. **Extracción y evidencia.** Componentes, operaciones y relaciones con archivo/símbolo/contrato. La IA puede proponer; la herramienta debe conservar de dónde salió y qué falta.
3. **Modelo intermedio neutral.** Separar componentes, interfaces, interacciones, estados y escenarios. No imponer al diagrama visual todos los detalles del código ni fijar hoy un nuevo schema de Fluyo.
4. **Identidad y reconciliación.** Conectar las entidades extraídas con las dibujadas entre revisiones. Distinguir cambio de nombre de componente nuevo; conservar anotaciones manuales.
5. **Abstracción narrativa.** Elegir una pregunta («¿cómo se confirma un pago?»), participantes y hechos relevantes. El modelo completo puede producir varias vistas/Historias, no un lienzo ilegible.
6. **Traducción con pérdida conocida.** Indicar qué cabe en FLOW/OCCURRENCE/UP-DOWN, qué sólo se anota y qué no se representa. Pasos con orden temporal no prueban una cadena causal real.
7. **Validación por herramientas.** Integridad, compatibilidad, límites y ejecución por el engine; después contraste con fuentes y revisión humana. Un Trace válido verifica las reglas de Fluyo, no que la descripción del código sea verdadera.
8. **Observaciones versionadas.** Ventana de captura, ids de correlación, tiempo y cobertura. Ausencia de observación no borra una relación declarada; una falla observada no demuestra un fallo permanente del componente.
9. **Evaluación.** Casos conocidos con relaciones esperadas, ambigüedades intencionales, cobertura y revisiones. Medir cuánto corrige el usuario, no sólo si el JSON abre.

**Primer experimento útil:** una fuente acotada de un flujo conocido → propuesta de Historia con referencias de evidencia → validación → usuario corrige. No «entiende el sistema completo» como requisito inicial. MCP completo sería la interfaz de escritura/consulta de esa cadena; no sustituye extracción, procedencia ni evaluación. Observaciones reales aportarían evidencia, no autoridad automática para cambiar el modelo ni la infraestructura.

## 9. Dependencias y propuestas de próximos slices

### Mapa de oportunidades, sin ranking numérico

| Familia | Impacto en el modelo | Reutilización actual | Dependencia dominante | Riesgo de expansión |
|---|---|---|---|---|
| Orientación/legibilidad visual | Presentación; conserva resultados. | Geometría, especificación y pintor común. | Caso visual donde la dirección hoy confunda; probar glifos. | Bajo si es optativo; alto si termina en editor de animación. |
| Lectura, inspección y comparación | Hace consultables los resultados existentes. | Historias múltiples, Trace, vocabulario, playback común. | Diferencias semánticas y navegación sin otro runtime. | Moderado; evitar analítica genérica y sincronización dual prematura. |
| MCP de Historias | Expone Structure + Behavior + History a otra forma de autoría. | Modelo, storyboard, engine, codecs y documento. | Contrato y validación compartidos, referencias, alcance global/local. | Moderado; sube mucho con edición en vivo o infraestructura. |
| Importación runtime | Añade evidencia a una explicación. | Canvas, Eventos, Historias y reproducción. | Mapping, procedencia, reducción y limitaciones de resultados/tiempos. | Alto si se ofrece streaming/monitorización antes de probar una captura. |
| Sincronización de fuentes | Vincula el modelo entre revisiones. | Referencias locales sólo parcialmente. | Identidad externa, reconciliación y conflictos. | Alto; no es un incremento pequeño a importar. |
| IA desde código | Produce propuestas desde evidencias. | MCP posible como destino; modelo visual existente. | Extracción, modelo intermedio, abstracción y evaluación. | Alto; evitar promesa de comprensión completa sin cobertura. |
| Branching/loops/objetos | Amplía la semántica ejecutable. | Validadores y versionado, pero no las nuevas reglas. | Causalidad, datos, terminación y UX comprensible. | Muy alto; no comenzar desde una lista de primitivas. |

### Propuesta 1 — Autoría y revisión de Historias mediante MCP

- **Objetivo:** un agente construye una Historia y una variante de falla como documentos revisables, y consulta sus consecuencias con el engine existente.
- **Usuario:** persona que explica un sistema con asistencia de un agente; también quien ya tiene un diagrama y quiere narrarlo sin repetir acciones manuales.
- **Problema:** MCP entrega figuras animadas, pero no puede trabajar formalmente con el vocabulario ni las Historias que hacen diferencial al producto actual.
- **Reutiliza:** EventTypes, funciones de Historia/storyboard, UP/DOWN, engine puro, documento v5 y enlaces al editor.
- **Qué habría que construir si se aprueba:** descubrimiento/resumen del modelo; operaciones de autoría con alcance explícito; adaptación/reutilización de validación; consulta de ejecución y resumen de cambios; contratos reales v5 y protección de referencias.
- **Riesgo:** divergencia editor/MCP, mutación global involuntaria, contadores/referencias mal gestionados, límites de documento y causalidad que el modelo no sabe expresar.
- **Por qué ahora:** amplía el acceso a un modelo ya sólido y deja una pieza reutilizable por futuras integraciones/IA. No necesita crear ramas ni tocar UI/Share/Viewer para validar el valor.
- **Límite de slice:** entrada y salida de documento; no bridge a sesión viva, no conectores autenticados ni acciones de producción; no prometer que Kafka procesa realmente algo.
- **Investigación de salida:** contrato mínimo y decisión de reutilización; dos guiones reproducibles de pago/caída; evaluación de edición incremental sobre un documento existente y de variantes con nombres/ids ambiguos. Éxito: original conservada, vocabulario correcto, referencias válidas y resultados iguales a los del editor. Detener expansión si exige un engine duplicado o nueva semántica para el caso básico.

### Propuesta 2 — Comparar dos Historias y explicar sus consecuencias

- **Objetivo:** responder «¿qué cambia y qué deja de completarse?» entre dos variantes del mismo sistema.
- **Usuario:** autor que revisa alternativas con un equipo, enseña un fallo o prepara una explicación.
- **Problema:** hoy selecciona/reproduce una, luego otra, y debe recordar diferencias y resultados. Tener N Historias resuelve almacenamiento y autoría, no comparación.
- **Reutiliza:** Scenarios de 016, engine/Trace, frases y referencias al mismo canvas.
- **Qué habría que construir si se aprueba:** lectura derivada de diferencias/resultados y acceso al acontecimiento implicado. Primera forma posible: comparación de texto/timeline sobre el mismo sistema; no dos canvas animados sincronizados. Alineación por acción/objetivo/Evento/momento, nunca sólo por Step id (los ids son locales y un duplicado los conserva).
- **Riesgo:** presentar diferencias narrativas como diferencias causales; comparar tras edición global del vocabulario sin que sea una ejecución histórica congelada; crecer hacia diff universal de documentos.
- **Por qué ahora o después:** alternativa inmediata si importa más el usuario manual que el agente; aporta valor con engine vigente. No obliga a reabrir 016, que ya cumplió su alcance. Compartir comparaciones puede investigarse después, sin hacerlo dependencia inicial.
- **Investigación de salida:** tres pares de Historias, incluyendo mismo nombre, simultaneidad y caída/recuperación; comprobar que alguien identifica la diferencia sin reproducir ambas por completo. No exigir ejecución paralela ni condiciones nuevas.

### Propuesta 3 — Explorar una Historia por momentos

- **Objetivo:** pausar, inspeccionar un momento y continuar para explicar una consecuencia concreta.
- **Usuario:** presentador o receptor que pregunta «¿por qué no llegó aquí?» y necesita tiempo para comprender.
- **Problema:** el playback continuo exige seguir su ritmo; detener implica resetear. Los puntos de progreso no son controles de exploración.
- **Reutiliza:** Trace determinista, grupos de momentos, captions y receta común de reproducción.
- **Qué habría que construir si se aprueba:** control temporal común de Historia y consulta del resultado de un momento. Investigar reconstrucción desde el Trace al saltar hacia atrás: `tick` consume eventos y acumula estado; no basta con bajar el reloj. Mismo comportamiento entre superficies, con presentación efímera y sin cambiar engine/schema.
- **Riesgo:** desacoplar editor/Present/Viewer, dejar overlays atrasados o confundir pausa con editar. Un buen primer alcance podría ser pausa+continuar y avance por momentos; scrub libre exige más validación.
- **Por qué ahora o después:** natural si el principal dolor es enseñar y revisar una Historia ya escrita; menos directo que MCP para abrir integraciones. No implementarlo como pequeño botón aislado por el riesgo temporal.
- **Investigación de salida:** prototipo conceptual con un fallo y un grupo simultáneo; definir estado al pausar/reanudar y requisitos de paridad. No ampliar motor ni convertir la timeline en editor de video.

### Propuesta 4 — Una traza real como Historia revisable

- **Objetivo:** explicar un recorrido observado usando una captura exportada de OpenTelemetry.
- **Usuario:** desarrollador o persona que explica un incidente/flujo y ya dispone de una traza.
- **Problema:** la Historia manual ilustra lo que se cree que ocurre, sin conexión explícita a lo observado.
- **Reutiliza:** elementos/conexiones, Eventos, Scenarios y playback/presentación/compartición existentes.
- **Qué habría que construir si se aprueba:** parser de un formato/version acotados, selección de servicios y momentos, mapping revisable, procedencia externa conservada y una propuesta abrible. Puede empezar como transformación fuera del editor con un artefacto de evidencia; no obliga a guardar todos los spans en el schema actual.
- **Riesgo:** equiparar error con DOWN, perder causalidad asíncrona, confundir duración visual con latencia, inventar participantes ausentes o transformar datos no filtrados en un enlace compartible.
- **Por qué después:** es la conexión más natural con sistemas reales, pero depende de mapping/procedencia y de aceptar qué no representa la v2. Si no pueden mostrarse tiempos/resultados fielmente, la investigación debe concluir un límite, no disimularlo con animación. Puede investigarse antes de MCP como transformación offline, pero MCP facilitaría autoría/revisión posterior.
- **Límite:** una captura local, finita, anonimizada y un recorrido; sin endpoint de observabilidad, stream, dashboard, broker ni escritura en sistemas reales.
- **Investigación de salida:** evaluar un recorrido HTTP y uno asíncrono con evidencia conocida; indicar qué fue observado, resumido o narrado. La pregunta es si la Historia explica mejor la captura sin mentir, no si puede dibujar todos sus spans.

## 10. Decisión pendiente y siguiente paso concreto

Para la siguiente investigación, elegir una pregunta:

- **MCP:** «¿Puede un agente crear y revisar dos Historias válidas sobre el mismo sistema sin inventar el comportamiento?» — recomendada por cerrar la mayor brecha entre el modelo disponible y su acceso externo.
- **Comparación/exploración:** «¿Puede una persona entender las diferencias y explicar un fallo sin volver a ver todo desde cero?» — alternativa si el foco sigue en experiencia manual/presentación.
- **Runtime:** «¿Una captura real se puede convertir en una Historia que conserve lo importante y declare lo que no puede representar?» — alternativa si se quiere validar integración antes que autoría asistida.

El siguiente paso es decidir ese problema y preparar un plan de investigación acotado con guiones, contrato/prototipo conceptual y criterio de cierre. **Este documento no autoriza implementar ninguna propuesta.** Mantener FLUYO-016 cerrado salvo mantenimiento de bugs; no usarlo como contenedor de comparación, branching ni controles nuevos.

No recomendar ahora: engine nuevo, catálogo de partículas/rotaciones, objetos con física, conexión live con todos los proveedores, escritura de infraestructura o comprensión automática completa del código. Cada dirección necesita primero demostrar un relato útil y su correspondencia con el modelo.

## 11. Handoff de esta auditoría

- **Qué se hizo:** lectura de contexto obligatorio, auditoría dirigida de ambos repos, revisión visual/conceptual en Chrome, verificación de capacidades y límites, clasificación de hallazgos y cuatro propuestas de investigación.
- **Archivos del proyecto modificados:** sólo `.ai/tasks/FLUYO-017.md` (nuevo, en `fluyo/`). La carpeta `.ai/` del directorio padre no es la de este repo y no se utilizó como destino.
- **Decisiones tomadas:** ninguna decisión de implementación, schema o engine. La preferencia por MCP es una recomendación para decidir, no un cambio a `.ai/DECISIONS.md` ni a la visión pública.
- **Validación:** 74/74 tests focalizados; 17 bloques browser OK; exploración adicional sin errores de página. B1 reproducido en UI, B2 reproducido sobre artefacto MCP local y contrastado con fuente. No se ejecutó la suite completa de MCP, no se recompiló ni cambió ese repo.
- **Riesgos pendientes:** Undo de Eventos; integridad de Historias tras borrado estructural en MCP; ausencia de datos de usuarios; semántica limitada de causalidad/errores/tiempos; documentación 016 desfasada respecto del commit local. Se reportan sin alterar documentos anteriores.
- **Restricciones cumplidas:** ningún cambio en producto, UI, schema, engine, Share, Viewer o MCP; ningún FLUYO-018, commit o push. Los scripts de exploración y capturas permanecen fuera de los repos.
- **Próximo paso:** decisión del usuario sobre qué problema investigar; después delimitar su investigación antes de aprobar desarrollo.
