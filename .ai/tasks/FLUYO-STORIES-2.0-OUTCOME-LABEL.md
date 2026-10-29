# FLUYO-STORIES-2.0 · Etiqueta del desenlace («Sin fallos»)

Fecha: 2026-10-29 · Base: `main` = `9d3096d` (fluyo.space sirve `fluyo-static-v120`) → CACHE **v121**.

**Estado: IMPLEMENTED / VERIFIED** (pendiente de publicación).

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
