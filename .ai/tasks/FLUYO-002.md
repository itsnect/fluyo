# FLUYO-002 — Product Analytics v2

Estado: DONE
Owner/agente actual: — (implementación y handoff: Codex)

> Fuente de verdad para continuar leyendo únicamente esta tarea y `AGENTS.md`. Contenido apto para el repositorio público.

## Objetivo

Auditar y mejorar Umami para medir abrir editor → empezar a editar → trabajar → presentar/exportar, con eventos fiables y propiedades cerradas. Documentar conceptualmente crear → explicar → presentar → compartir sin implementar funciones futuras.

## Por qué

Evitar métricas basadas en clics, ediciones inexistentes o resultados no verificables y preservar la privacidad.

## Alcance

### Incluye

- Auditar `editor_opened`, `first_edit_completed`, `diagram_created`, `diagram_saved`, `present_started`, `present_completed`, `diagram_exported`, `file_imported`.
- Primera edición real como máximo una vez por sesión de editor; pan, zoom, hover y selección excluidos.
- Formatos fiables y de baja cardinalidad para importación/exportación.
- Determinar desde este frontend si existe procedencia MCP fiable; si no, dejar pendiente.
- Reservar documentalmente `share_created`, `share_viewed`, `share_opened_in_editor`.

### No incluye

- Share, Explain, backend, autenticación, framework, build ni funciones nuevas.
- Cambiar comportamiento del editor o formato `.fluyo.json`; explorar repositorios hermanos; commit/push; FLUYO-003.
- Enviar contenido, nombres de nodos/archivos, prompts, URLs privadas, IDs, texto del usuario o datos personales.

## Contexto necesario

Leer después del bootstrap, sólo según la dependencia:
- `AGENTS.md` y esta tarea.
- `.ai/ARCHITECTURE.md`: mapa, persistencia y Testing para situar puntos de instrumentación y validaciones.
- `.ai/DECISIONS.md`: decisiones vigentes sobre privacidad, analytics y arquitectura antes de adoptar decisiones duraderas.
- `js/analytics.js`: instrumentación actual; búsquedas dirigidas de llamadas y mutaciones en los archivos implicados.
- Secciones pertinentes de `js/state.js`, `js/selection.js`, `js/interaction.js`, `js/ui.js`, `js/export.js`, `js/deeplink.js`, `js/examples.js` e `index.html` cuando haya dependencias concretas.
- `js/config.js`, únicamente catálogo ANIMS para cerrar los valores permitidos de la instrumentación preexistente.
- `sw.js` para actualizar la caché de archivos servidos; documentación/tests de analytics sólo si las búsquedas muestran su existencia.
- `privacidad/index.html` y `privacy/index.html`, bloque de telemetría: D-004 exige actualizar la política al ampliar eventos. `docs/index.html`, resumen de telemetría, localizado por búsqueda dirigida.
- Documentación oficial de Umami (configuración del tracker y funciones): verificar el filtro de payload porque los eventos incluyen URL, título y referrer automáticamente.
- `test/documento-entrante.html` y `test/editor-inline.html`: referencias dirigidas al modo de carga del editor para comprobar compatibilidad de los nuevos helpers.

No es necesario leer otros documentos de producto, tareas anteriores ni repositorios hermanos.

## Criterios de aceptación

- [x] Auditoría inicial y taxonomía final documentadas con significados reales.
- [x] Eventos asociados a resultados verificables; primera edición real y única por sesión.
- [x] Privacidad y vocabularios cerrados conservados; procedencia MCP evaluada desde frontend.
- [x] Pruebas automatizables razonables y checklist manual registradas.
- [x] Handoff completo con archivos, decisiones, riesgos y siguiente paso.

## Plan

- [x] Leer AGENTS y crear tarea usando el template.
- [x] Releer únicamente AGENTS y tarea antes de consultar contexto autorizado.
- [x] Auditar instrumentación y rutas relevantes.
- [x] Implementar ajustes proporcionales y actualizar caché/documentación.
- [x] Validar y completar handoff.

## Decisiones tomadas

- Auditoría: había siete eventos: `diagram_created` en dos rutas de inserción (una vez por carga, incluso sobre documentos existentes), `present_started` al entrar al modo, `diagram_exported` al iniciar la generación, `file_imported` tras importación (sin source en disco), `example_loaded`, `gif_animation_added`, `link_failed`.
- No existían `editor_opened`, `first_edit_completed`, `diagram_saved` ni `present_completed`. El helper no validaba propiedades y perdía eventos anteriores a la carga de Umami. Sólo se excluía hash; query, referrer y título quedaban en el payload automático.
- Existe Guardar: descarga explícita de `.fluyo.json`. No hay confirmación del navegador de escritura a disco; se medirá descarga generada/iniciada, sin contar autosave.
- No hay final semántico verificable de presentación: salir o llegar a la última página no significa completar. No implementar `present_completed`.
- Desde el frontend, `#d=` y `.fluyo.json` prueban transporte/formato, no autoría MCP. Sin señal fiable: atribución MCP pendiente, no inferirla ni modificar el formato.

## Taxonomía final

| Evento | Momento y límite | Propiedades |
|---|---|---|
| `editor_opened` | DOM del editor listo; una vez por carga de página | Ninguna |
| `first_edit_completed` | Primera diferencia real de estado editable, después del gesto confirmado; máximo una por carga | Ninguna |
| `diagram_created` | Primera transición mediante edición de documento sin nodos a documento con nodos, máximo una por carga | Ninguna |
| `diagram_saved` | Guardar genera e inicia descarga explícita; autosave excluido | `format: fluyo_json` |
| `present_started` | Entrada efectiva al modo, aunque se deniegue fullscreen; una por entrada | Ninguna |
| `diagram_exported` | SVG generado, PNG/JPG con blob válido o GIF finalizado; descarga iniciada | `format: png / jpg / svg / gif` |
| `file_imported` | Documento validado y aplicado desde archivo o enlace; cancelar/conservar lo mío excluido | `source: file / link`, `format: fluyo_json` |
| `example_loaded` | Ejemplo aplicado; catálogo preexistente | `example`: demo o uno de los ocho slugs de galería |
| `gif_animation_added` | Animación predefinida insertada; evento preexistente | `anim`: una de las ocho claves |
| `link_failed` | Error de carga de enlace; evento preexistente | `reason: decode / schema / too_large / unsupported` |

`present_completed` no se implementa: no existe una señal fiable de finalización. `file_imported` mide documentos Fluyo, no imágenes pegadas; pegar imágenes sí puede activar primera edición/creación. Importar/restaurar/ejemplos no equivalen a creación o edición manual.

Sesión = carga de la página, no documento ni localStorage. Cambiar/importar documento no rearma la primera edición. La comparación local excluye página activa, contadores nextId, vista, selección, grid, snap y single; incluye páginas, contenido y ajustes visuales del diagrama. Se descartan diferencias provisionales de gestos/texto y velocidad temporal del GIF. Sólo se almacena la referencia en memoria y se deja de comparar al alcanzar los dos hitos.

### Loop conceptual y eventos reservados

Crear → explicar → presentar → compartir es un mapa conceptual, sin implementación de features futuras. Crear se aproxima mediante primera edición/creación; trabajar mediante ediciones y resultados observables de guardado/exportación, sin registrar cada acción. Explicar no tiene señal actual; presentar se mide sólo al iniciar.

Reservados, **no implementados ni admitidos en el helper**:
- `share_created`: futuro recurso compartible creado con éxito, no clic en botón.
- `share_viewed`: futura vista compartida cargada con éxito.
- `share_opened_in_editor`: futuro recurso compartido aplicado realmente al editor.

No reutilizar importación genérica por enlace como Share. La futura medición deberá mantener vocabularios cerrados y no enviar IDs, URLs ni contenido. No se implementó correlación por documento ni atribución MCP.

## Archivos modificados

- `.ai/tasks/FLUYO-002.md`: bootstrap, auditoría, taxonomía, checklist y handoff.
- `.ai/DECISIONS.md`: D-007, semántica y privacidad durable.
- `.ai/ARCHITECTURE.md`: analytics y comando de regresión disponible.
- `js/analytics.js`: vocabularios cerrados, filtro de payload, cola de 100 eventos en memoria, apertura y comparación de primera edición/creación.
- `js/state.js`: comprobar ediciones desde scheduleAutosave; actualizar referencia tras aplicar/restaurar/añadir documentos.
- `js/interaction.js`: retirar primera inserción antigua; distinguir selección/gestos y confirmar texto antes de comprobar.
- `js/ui.js`: comprobar edición confirmada antes de iniciar presentación.
- `js/export.js`: guardado, origen/formato de importación, exclusión de demo y eventos tras generación de descarga.
- `js/deeplink.js`: formato validado de documento importado desde enlace.
- `privacidad/index.html`, `privacy/index.html`: catálogo y límites públicos actualizados; bloque nuevo en español (marcado `lang=es` en la variante inglesa, conforme a AGENTS §8).
- `sw.js`: caché v28 → v29.
- `test/analytics.test.cjs`: regresión con Node, sin red, framework ni dependencias.

## Pruebas

- `node --test test/analytics.test.cjs`: 13/13 pruebas pasaron. Incluye cola inicial/hosts, primera edición única, cambios reales, no-op, navegación, gestos/texto provisionales, importación/demo, privacidad, fallos síncronos/asíncronos, descarga de JSON/estáticos y GIF terminado/cancelado/fallido. La última prueba ejecuta el handler pointerup real y verifica que limpiar rutas durante una selección sin movimiento no cuenta como editar, pero desplazar el nodo sí.
- Pruebas con VM y DOM/proveedor simulados: no se envió telemetría real. No sustituyen la validación visual ni la recepción en Umami.
- Verificación final con `vm.Script`: sintaxis válida de los 11 scripts clásicos referenciados por el editor y `sw.js`; concatenación en orden válida, sin colisiones léxicas globales. `git diff --check`: pasó sin errores.

### Checklist manual pendiente

- [ ] Abrir `index.html` desde file:// y HTTP local; consola sin errores y ninguna solicitud Umami.
- [ ] En entorno controlado con hostname permitido y Umami simulado/interceptado: una apertura, primera edición única; recargar inicia otra sesión; importar/cambiar páginas no la reinicia.
- [ ] Hover, selección de nodo/flecha (incluidos anclajes automáticos), pan, zoom y navegación no cuentan. Arrastrar sin mover y texto cancelado con Escape tampoco.
- [ ] Crear/pegar formas e imágenes, mover/redimensionar, conectar, editar texto/estilo, borrar y undo/redo: primera modificación confirmada cuenta.
- [ ] Importar archivo válido/antiguo/inválido; enlaces válidos/rotos y conflicto abrir/añadir/conservar. Restaurar autosave y cargar demo/galería no cuentan como edición.
- [ ] Guardar con botón/Ctrl+S; reabrir el archivo y comprobar integridad `.fluyo.json`.
- [ ] Exportar PNG/JPG/SVG/GIF y revisar visualmente; cancelar/fallar GIF no genera exportación. Comprobar GIF en navegador real con worker.
- [ ] Entrar/salir de presentación con botones/atajos y fullscreen denegado; sólo un inicio por entrada, nunca completed.
- [ ] Inspeccionar requests reales tras despliegue autorizado: ruta/título fijos, referrer vacío, sin query/hash/textos/IDs; verificar recepción en Umami y carga lenta/bloqueo del proveedor.
- [ ] Confirmar actualización del service worker a v29 y ejecutar harness HTML existentes si se realiza QA visual.

## Pendientes / riesgos

- Atribución MCP pendiente: no hay señal verificable en el frontend; no se exploró el repo hermano.
- No se verificó recepción real en Umami ni navegador gráfico; quedan explícitamente las pruebas manuales de arriba.
- La semántica de `diagram_created` y `diagram_exported` cambia: no comparar series históricas sin señalar esta revisión. Guardar/exportar no prueban escritura final a disco.
- La cola es acotada, volátil y sin reintentos: bloqueo, cierre temprano, saturación o fallo de red pueden perder eventos; no prometer entrega exactamente una vez.
- Comparación local serializa el estado hasta alcanzar primera edición y creación; documentos muy grandes pueden tener coste. No añade dependencias ni cambia la persistencia.
- Se elimina atribución automática por referrer/query y metadatos de navegador para preservar privacidad; ejemplo sigue medido por slug validado.
- En un comentario preexistente del bloque del botón Ejemplo de `js/export.js` aparece una cifra de tráfico potencialmente interna. No se modificó ni se reproduce; revisar su carácter público por separado (AGENTS §9).

## Handoff

### Estado actual

DONE: auditoría, implementación, regresión y documentación completadas. Bootstrap respetado: se localizó únicamente AGENTS al no existir en la carpeta contenedora, se leyó el template, se creó la tarea y se releyeron sólo AGENTS+tarea antes de ampliar contexto. No se consultaron otras tareas ni repositorios hermanos. No se alteró el formato `.fluyo.json`, no se implementaron features futuras y no hubo commit/push.

Contexto adicional efectivamente leído: `.ai/ARCHITECTURE.md`, `.ai/DECISIONS.md`, `js/analytics.js`, `js/state.js`, `js/selection.js` y secciones/búsquedas dirigidas en `js/interaction.js`, `js/ui.js`, `js/export.js`, `js/deeplink.js`, `js/examples.js`, `js/config.js` (catálogo ANIMS), `index.html`, `sw.js`, políticas de privacidad, resumen de `docs/index.html` y referencias de scripts en los dos harness HTML existentes. No se leyó PRODUCT ni se reabrió investigación anterior.

Fuentes externas técnicas: [configuración oficial Umami](https://docs.umami.is/docs/tracker-configuration) y [funciones del tracker](https://docs.umami.is/docs/tracker-functions), para confirmar el hook before-send y los metadatos automáticos. Las decisiones duraderas están en D-007.

### Próximo paso concreto

Leer AGENTS + esta tarea y ejecutar la checklist manual sobre estos cambios, empezando por file:// y los gestos sin edición; después verificar payloads con proveedor interceptado. No continuar con FLUYO-003. Cualquier validación de recepción en producción requiere su despliegue por el flujo habitual; esta sesión no desplegó.
