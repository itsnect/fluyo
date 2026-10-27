# FLUYO-I18N-002 · S2b — El texto de la reproducción y los nombres sembrados de Historia, con el kernel intacto para el MCP

Estado: **IMPLEMENTADA Y VERIFICADA EN LOCAL, SIN COMMIT NI DEPLOY** (2026-10-27). Pendiente del OK del PO para commitear los dos repos y
desplegar el MCP.
Base: `main` = `86d910a` (S4, commiteada; `CACHE` v112). S2b usa **`CACHE` v113**. `fluyo-mcp` parte de `24a537d`.
Decisiones del PO: D-S2-1…7 (289–295) y N1–N3 (2026-10-27); registradas como **296–299**.

> Repo público: solo contenido técnico.

## Qué hace

Con `?lang=en`, el texto de la reproducción que compone el kernel y los nombres de Historia nueva y copia salen en inglés. En español todo
es **idéntico** a `326872e` / `86d910a`. fr/ja/zh caen al inglés, nunca al español. El contenido del autor nunca se traduce.

- **Proveedor de texto opcional** (decisión 296). `story-playback.js` (`errorMessages`, `start`, `caption`, `summary`, `describe`,
  `sentence`) y `story-clock.js` (`start`, `describe`) aceptan, como último argumento, `text(clave, español, params)`.
  - Sin él, el español de siempre, byte a byte. fluyo-mcp no lo pasa.
  - El kernel no nombra `FluyoI18n` ni ninguna global de la interfaz.
  - Los 15 errores son una tabla de funciones `tx => tx("story.err.<camelCase>", "…")`, con las claves literales (las ve el escáner).
  - El plural del cierre es `{one, other}` con `count`.
  - Quien consume pasa `FluyoI18n.t`: el editor (`scRun`, `scRenderNow`, el ejemplo del mensaje del paso), Present (`describe` y la
    sonda de `presentHeaderBottom`, que ahora mide el cierre real en el idioma activo) y el Viewer (`start`, `describe`).
- **Formateador K1** (297). `defaultScenarioName(pg, fmt)`, `copyScenarioName(pg, name, fmt)` y `duplicateScenario(pg, id, fmt)` aceptan
  `fmt = {story(n), copy(name), copyN(name, n)}`. La regla (nombre único, recorte a 120) sigue siendo una sola, del kernel; el recorte
  mide el sufijo ya formateado: el mayor entre `copy("")` y `copyN("", 999)` (en español, 10 = `" copia 999".length`, como antes). El
  editor lo construye (`scSeedNames()`) con `seed.story`, `seed.storyCopy` y `seed.storyCopyN` en 3 sitios (+ nueva, colocar sin Historia y
  duplicar). Guardado, el nombre es contenido: no se retraduce al cambiar de idioma ni al reabrir.
- **N3**: los errores de arranque se forman al arrancar, en el idioma de ese momento. `start()` conserva su contrato `{ok, errors:[texto]}`.

## Archivos

Servidos (`CACHE` v112 → **v113**; sin archivos nuevos; `ASSETS` y `VIEWER_ASSETS` sin cambios):

| Archivo | Qué |
|---|---|
| `js/story-playback.js` | **kernel**: `plainText`/`textOf`, tabla de errores por función, proveedor en las 6 funciones |
| `js/model.js` | **kernel**: K1 (`SEED_*_ES` + `fmt` en 3 funciones) |
| `js/story-clock.js` | pasa `text` a `start` y `describe` (no es kernel) |
| `js/editor-scenarios.js` | `scSeedNames()`; `FluyoI18n.t` a `start`, `describe` y `sentence`; el formateador en 3 llamadas |
| `js/present-story.js` | `describe` y la sonda con `FluyoI18n.t` |
| `js/viewer.js` | `start` y `describe` con `FluyoI18n.t` |
| `js/i18n-en.js` | +21 claves comunes del kernel (una, `story.finished`, movida desde el editor) |
| `js/i18n-en-editor.js` | +3 claves `seed.*`; `story.finished` fuera |
| `sw.js` | solo `CACHE` v113 |

`fluyo-mcp`: solo `src/generated/kernel-sources.ts` (`npm run sync:kernel`) y el test nuevo `test/fluyo-i18n-002-s2b.test.ts`.
`config.js`, `safe-svg.js`, `scenario-engine.js`, `scenario-playback.js`, `document-integrity.js` y `story-authoring.js`: idénticos.

## Claves

- **24 claves en los diccionarios** (23 netas nuevas): 21 comunes (`story.err.*` ×16, `story.cap.down|up|failed`, `story.failedCount` y `story.finished`, esta movida desde el editor) y 3 del editor. El kernel usa además `story.unnamed`, que ya existía.
  El inglés es exactamente el vocabulario aprobado por el PO.
- fr/ja/zh sin claves (D-S2-7): caen al inglés y quedan en `missing()`.
- El escáner (`test/i18n-scan.cjs`) reconoce también `tx("clave", "texto base")` (el kernel no puede escribir `FluyoI18n.t`).
- Trinquete: `story-playback.js` 23 → **1** (`NARRATED_NOTE`, salida del MCP); `model.js` 10 → 9.

## Pruebas

- `test/fluyo-i18n-002-s2b.test.cjs` (**14**): oráculo del español frente a `86d910a` (también con `FluyoI18n.t` en español), corpus
  aleatorio de nombres y recortes, inglés exacto, fr/ja/zh → inglés, idioma de prueba CJK (una plantilla por salida), el kernel sin
  interfaz, N3, vivo, estático, claves en el común, trinquete, lo que llama el MCP sin cambios, `kernel-sources.ts` = este kernel, alcance.
- `test/fluyo-i18n-002-s2b-mutations.cjs`: **16/16 detectadas** (el test A de alcance se excluye).
- `test/fluyo-i18n-002-s2b-browser.cjs` (Chrome real por CDP, sin Playwright): **34 ✔ · 0 ✘**.
- `test/fluyo-i18n-002-s2b-undo.cjs` (`undoS2b`, generado del diff `-U2`): lo llama primero `undoS4`. Se ajustaron los `Only` de S0, S1, S2a
  y SHELL, `undo029` (story-clock) y las aserciones que leían el texto exacto de `start`/`describe` (014, 018-18, 018-21).
- **fluyo-mcp**: `npm test` **919/919** (914 + 5 nuevos); `check:kernel` OK.
- **Suite de fluyo** (clon desechable con S2b commiteada sobre `86d910a`): 1 748 tests, 81 fallos, **0 nuevos por nombre** frente a la base
  (1 734 / 83). Los 2 que la base falla y aquí pasan son de fin de línea del clon (`function scMenu(anchor, items) {` con CRLF).

## Fuera de S2b

Nodos `code` con celdas dobles y `xml:lang` + `safe-svg.js` (S4 los dejó para otra resincronización; decisión 298), S3 (otros valores
sembrados, `config.js`), S5 (fr/ja/zh), S6, S7, Propiedades.

## Handoff

- Con el OK del PO: commit de `fluyo` (solo los archivos de arriba, los tests de S2b y los ajustados, `.ai/DECISIONS.md` y
  `.ai/ARCHITECTURE.md`; los `.ai/tasks/*` de otras sesiones quedan fuera), **después** `npm run sync:kernel` en `fluyo-mcp` (para que la
  revisión estampada sea la del commit; el contenido y el `kernelId` no cambian), commit del MCP, push de los dos, despliegue del MCP
  (`deploy mcp.bat`) y comprobación (`verify` y un smoke del kernel publicado).
- Hasta desplegar el MCP, el `kernelId` publicado no coincide con el del repo (como en KERNEL-SYNC-001).
- Siguiente: S3a (sin kernel) o la resincronización con `code` y `xml:lang`.
