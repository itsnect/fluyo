# FLUYO-STORIES-2.0 · Etiqueta del desenlace («Sin fallos»)

Fecha: 2026-10-29 · Base: `main` = `9d3096d` (fluyo.space sirve `fluyo-static-v120`) → CACHE **v121**.

**Estado: CLOSED / VERIFIED / IN PRODUCTION** (`1d9286f`, fluyo.space sirve v121). Con este fix, Stories 2.0 queda cerrada.

## Problema (gate de producto de Stories 2.0)

«Termina bien» solo significaba «ningún envío falló», pero se leía como «la historia acaba bien». Con S2a y S2b la etiqueta llega al
selector, a la portada del Viewer y a «Otras formas». Una variante como «El banco rechaza la tarjeta» (termina en «El cliente ve
«Pago rechazado»») aparecía como «Termina bien». Al ejemplo publicado «El usuario no autoriza» le pasaba lo mismo.

## Cambio

- **Español:** «Termina bien» → **«Sin fallos»**.
- **Inglés:** «Ends well» → **«No failures»**.
- **Sin cambios:** «Falla en el paso N» / «Fails at step N».

La etiqueta dice solo lo que el motor comprueba: ningún envío de la Historia falló. No afirma que el resultado sea bueno (decisión 319).

**Una sola regla:** `FluyoStoryClock.outcomeText`, que ya consumen el editor (storyboard y selector), Present y el Viewer (portada y
«Otras formas»). Ninguna superficie cambia de lógica.

## Archivos

| Archivo | Cambio |
|---|---|
| `js/story-clock.js` | El texto por defecto de `story.outcome.ok` y su comentario |
| `js/i18n-en.js` | `story.outcome.ok`: «No failures» |
| `sw.js` | CACHE v121 |
| `.ai/DECISIONS.md` | 319 |
| `test/fluyo-stories-2-0-outcome-undo.cjs` | Capa de deshacer (`undoOutcome`, base 9d3096d); `undoS2b` la llama primero |
| Tests de S1b, S2a y S2b (vm, mutaciones, Chrome) | El texto esperado |
| Alcances que registran S2b | Registran `PIECES_OUT` |
| 88 tests | CACHE v120 → v121 |

**No cambian:**

- kernel, formato, MCP, Share, Viewer, Present y `editor-scenarios.js`;
- ejemplos (sus documentos no guardan la etiqueta).

Los comentarios de `index.html` y `editor-scenarios.js` que citan «Termina bien» quedan como están, porque esos archivos están fuera del alcance.

## Pruebas

- **Tests propios de Historias (vm):** S1a, S1b, S2a y S2b, 65/65.
- **Suite completa** en un clon con el fix commiteado: 1839 tests / 83 fallos, los mismos 83 de la base (`9d3096d`), 0 nuevos.
- **Mutaciones:**
  - S2a 21/21 y S2b 24/24;
  - S1b 25/28: M12, M24 y M25 tienen patrones obsoletos, igual en la base `9d3096d`. Son deuda de tests de S1b desde S2a/S2b, no de este fix.
- **Chrome** (clon): S2b 40/0, S2a 50/0, S1b 47/0, EXAMPLES 40/0. Cubren selector, portada, «Otras formas», Present, inglés y Share → Viewer con «Sin fallos» / «No failures» y «Falla en el paso N».

## Publicación (29-10-2026)

- **Commit:** `1d9286f` en `stories-2.0-outcome-label`; `main` avanzó por fast-forward desde `9d3096d`.
- **En `main`:** S1a, S1b, S2a y S2b, 65/65.
- **Push y deploy:** push `9d3096d..1d9286f`. fluyo.space sirve `fluyo-static-v121`. 10 archivos servidos coinciden byte a byte con el commit, entre ellos `story-clock.js`, `i18n-en.js`, `sw.js`, el editor, el Viewer, Present y Share.
- **Smoke de producción** (QA de Chrome contra https://fluyo.space, Umami bloqueado): S2b 40/0, S2a 50/0, S1b 47/0.
- **A mano en producción**, con la Historia «Compra con éxito» (falla en el paso 4) y su variante «El banco rechaza la tarjeta»:
  - selector: «Falla en el paso 4» / «Sin fallos»;
  - storyboard: «Sin fallos»;
  - Share → Viewer: portada «Compra online / El banco rechaza la tarjeta · Sin fallos» y tarjeta «Otras formas: El banco rechaza la tarjeta · Sin fallos»;
  - inglés: «No failures».
- **Encontrado, no bloquea y fuera de este fix:** si se cambia el idioma en vivo con `FluyoI18n.setLocale` en el Viewer, el `data-i18n` de `#stKicker` repinta «Story» encima del nombre del sistema, y la caché de `storySet` no lo corrige. No se puede alcanzar desde la interfaz: el Viewer no tiene selector de idioma ni sincroniza el idioma entre pestañas, y al cargar con `?lang=` sale bien.
- **Deuda de tests conocida:** mutaciones de S1b M12/M24/M25 obsoletas desde S2a/S2b; S3a 29/6, STEP-MESSAGE 83/86, SHELL 137/2.
- **Siguiente CACHE libre:** v122.
