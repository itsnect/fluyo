# FLUYO-I18N-002 · S2b — El texto de la reproducción y los nombres sembrados de Historia, con el kernel intacto para el MCP

Estado: **CLOSED / VERIFIED / IN PRODUCTION** (2026-10-27): fluyo `be050f8` (`CACHE` v113) y fluyo-mcp `464f4e0` (Cloud Run
`fluyo-mcp-00035-qvg`, 100 %). Ver «Publicación».
Base: `main` = `86d910a` (S4; `CACHE` v112). S2b usa **`CACHE` v113**. `fluyo-mcp` partía de `24a537d`.
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

## Publicación — CLOSED / VERIFIED / IN PRODUCTION (2026-10-27)

- Commit `be050f8` de fluyo (100 archivos) y `464f4e0` de fluyo-mcp (solo `kernel-sources.ts` y el test nuevo). Push sin force
  (`86d910a..be050f8`, `24a537d..464f4e0`).
- **Kernel:** `sync:kernel` desde `be050f8` (estampa definitiva). `KERNEL_ID` `4dfe7dc6…` → `f1fe2c32c26615c62db225442e55534db6df5ebb374152abf3c6696d88a30fcc`.
  Solo cambian `model.js` (`a09ba5a7…`) y `story-playback.js` (`a444ce71…`); `check:kernel` OK.
- **MCP:** `npm test` 919/919; Cloud Run `fluyo-mcp-00035-qvg` (antes `00034-h2n`); `verify-deploy.sh` **21/21**; smoke de producción **8/8**
  (`kernelId` publicado = el del repositorio; `create_story` y `duplicate_story` siguen sembrando en español, con su recorte a 120;
  `run_story` y `describe_document` sin proveedor: «Elemento sin nombre», estados por código).
- **fluyo.space:** sirve `fluyo-static-v113`; los 83 archivos servidos comparados (JS, CSS, HTML, manifest, assets y páginas) son
  **idénticos** a `be050f8`.
- **Chrome de producción** (`test/fluyo-i18n-002-s2b-browser.cjs` contra https://fluyo.space, telemetría bloqueada, más SW v113 sin red):
  **38 ✔ · 0 ✘**: español idéntico a `326872e` (reproducciones, error de arranque, documento, hoja píxel a píxel, Present, Viewer, nombres),
  inglés (`Not completed · Banco is unavailable`, `Playback finished · 1 step couldn't run`, `Story 1`, `Story 1 copy`), fr → inglés, Share → Viewer y
  offline.
- Suite de fluyo tras el commit: 1 748 tests, 81 fallos = los mismos de la base por nombre, 0 nuevos. Con S2b commiteada,
  `.ai/DECISIONS.md` lleva también las decisiones 277–295 (estaban sin commitear).

## Handoff

- Siguiente: S3a (sin kernel, `CACHE` v114) o la resincronización del kernel con `code` y `xml:lang` (decisión 298).
