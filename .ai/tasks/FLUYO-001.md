# FLUYO-001 — Arquitectura de contexto multiagente

Estado: DONE — READY TO COMMIT
Owner/agente actual: —

## Objetivo

Crear la arquitectura mínima de documentación para que sesiones y agentes distintos (Codex, Claude Code, OpenCode/Kimi) trabajen sobre el repositorio sin reconstruir el contexto en cada sesión, optimizando el consumo de tokens.

## Por qué

El chat es efímero. El repositorio debe contener el contexto necesario para continuar el trabajo; una sesión nueva solo debería leer `AGENTS.md` + `.ai/tasks/<TASK>.md`.

## Alcance

### Incluye

- `AGENTS.md` en la raíz del repo (bootstrap, política de contexto, fuente de verdad, handoff, restricciones duras y regla de confidencialidad para repo público).
- `.ai/PRODUCT.md` (visión pública y estable: crear, explicar, presentar, compartir sistemas técnicos).
- `.ai/ARCHITECTURE.md` (arquitectura técnica real actual, como mapa navegable).
- `.ai/DECISIONS.md` (índice de decisiones técnicas D-001…D-006).
- `.ai/tasks/_TEMPLATE.md` (template de tarea, con aviso de visibilidad pública).
- `.ai/tasks/FLUYO-001.md` (esta tarea, con handoff completo).
- **Ajuste de alcance (frontera open source / producto)**: todos los documentos limitados a contenido apto para repositorio público; roadmap privado eliminado de PRODUCT.md; regla de confidencialidad añadida en `AGENTS.md` §9.

### No incluye

- Ningún cambio de código productivo, dependencias, APIs o formato `.fluyo.json`.
- Documentación extensa o duplicada; roadmap/backlog de producto.
- Exploración del repositorio hermano `fluyo-mcp` (referenciado solo por su contrato visible desde el README).

## Contexto necesario

Leer (solo esto antes de empezar):
- `AGENTS.md`
- Árbol de primer nivel, `README.md`, `CONTRIBUTING.md` y orden de scripts en `index.html` para el reconocimiento dirigido.

No es necesario leer:
- Los `js/*.js` archivo por archivo (el mapa de CONTRIBUTING § "Estructura de archivos" basta).
- `docs/`, `ejemplos/data/`, páginas legales.
- Repositorios hermanos.

## Criterios de aceptación

- [x] Existe `AGENTS.md`.
- [x] Existe `.ai/PRODUCT.md`.
- [x] Existe `.ai/ARCHITECTURE.md`.
- [x] Existe `.ai/DECISIONS.md`.
- [x] Existe `.ai/tasks/_TEMPLATE.md`.
- [x] Existe `.ai/tasks/FLUYO-001.md`.
- [x] `AGENTS.md` se entiende rápido (≤150 líneas) y no es documentación masiva.
- [x] Otro agente puede iniciar leyendo únicamente `AGENTS.md` + una tarea.
- [x] `ARCHITECTURE.md` describe el sistema actual, no una arquitectura imaginada.
- [x] Ningún código productivo ha cambiado.
- [x] No se han cambiado dependencias.
- [x] `git diff` contiene únicamente documentación de esta tarea.

## Plan

- [x] Reconocimiento dirigido (README, CONTRIBUTING, árbol, `index.html`).
- [x] Redactar `AGENTS.md`.
- [x] Redactar `.ai/PRODUCT.md`.
- [x] Redactar `.ai/ARCHITECTURE.md`.
- [x] Redactar `.ai/DECISIONS.md`.
- [x] Redactar `.ai/tasks/_TEMPLATE.md`.
- [x] Redactar esta tarea con el handoff.
- [x] Validación final (git diff, rutas, tamaños).

## Decisiones tomadas

- Registradas como D-001…D-006 en `.ai/DECISIONS.md`.
- **Ajuste final (revisable ≠ permanente)**: D-001, D-002 y D-005 reformuladas de "restricción dura" a **estado técnico actual, vigente / revisable**. Eliminadas las formulaciones tipo "nunca módulos ES"; el principio rector es: *mantener Fluyo radicalmente simple mientras esa simplicidad sea suficiente; añadir complejidad (módulos ES, build tooling, dependencias, backend, otra estrategia de caché) sólo ante necesidad concreta de producto o mantenibilidad, con decisión explícita*. `AGENTS.md` §6 se alineó con el mismo criterio (describe el estado actual sin prohibir el futuro). D-003 (retrocompatibilidad del formato `.fluyo.json`) y D-004 (privacidad) se mantienen como restricciones durables, por contrato con usuarios.
- **Alineación documental final**: `README.md` (3 párrafos) y `CONTRIBUTING.md` (5 bloques) reformulados para eliminar contradicciones con D-001/D-002/D-005. Pasada 1: "regla dura / nunca módulos ES" → "convención / estado técnico actual, revisable" (README § "Cómo correrlo en local"; CONTRIBUTING § "Convención actual" título + párrafo, y bullet de dependencias/build de § "Qué PRs son bienvenidas"). Pasada 2 (última corrección previa a commit): formulaciones planas que sonaban a permanencia —README § presentación (l. 25: "no tiene backend… sin dependencias ni paso de compilación") y § "Contribuir" (l. 151: "no hay build, no hay dependencias"); CONTRIBUTING § "Cómo correr el proyecto" (l. 7: "No hay build.") y nota del service worker (l. 19: obligación de subir `CACHE`)— marcadas como **estado técnico actual, revisable**, con referencia a `.ai/DECISIONS.md`. Sin reestructurar ni tocar otras secciones; sin cambios de código.
- Ajuste de alcance (repo público): ningún documento `.ai` registra estrategia comercial, métricas internas, pricing, hipótesis competitivas ni roadmap privado; `AGENTS.md` §9 fija la regla explícita y cada tarea/template la hereda.
- Decisiones menores de esta tarea: los documentos viven **dentro del repo `fluyo/`** (no en la carpeta padre `fluyo-new`, que no es un repositorio git); `fluyo-mcp` se documenta solo por su contrato visible desde el README, sin explorarlo.

## Archivos modificados

- `AGENTS.md` — nuevo (incluye §9 confidencialidad y §6 alineado al criterio "estado actual, no prohibición permanente").
- `.ai/PRODUCT.md` — nuevo.
- `.ai/ARCHITECTURE.md` — nuevo.
- `.ai/DECISIONS.md` — nuevo (D-001/D-002/D-005 marcadas `vigente / revisable` con el principio rector).
- `.ai/tasks/_TEMPLATE.md` — nuevo.
- `.ai/tasks/FLUYO-001.md` — nuevo (este archivo).
- `README.md` — 3 párrafos: § presentación (l. 25: "no tiene backend / sin dependencias" → estado actual deliberado y revisable + referencia a DECISIONS.md); § "Cómo correrlo en local" (l. 65: "regla dura" → "convención" + nota de estado actual revisable); § "Contribuir" (l. 151: "no hay build, no hay dependencias" → "hoy no hay build ni dependencias", decisión revisable + referencia).
- `CONTRIBUTING.md` — 5 bloques: § "Cómo correr el proyecto" (l. 7: "No hay build." → "Hoy no hay build." + nota revisable); nota del service worker (l. 19: obligación de subir `CACHE` matizada como estrategia actual, no permanente); § "Convención actual" (título + párrafo: "nunca módulos ES" → convención actual, revisable); bullet de dependencias/build de § "Qué PRs son bienvenidas" ("restricción deliberada" → "decisión deliberada y revisable").

## Pruebas

- No aplica (tarea de documentación; no hay suite automatizada en el repo — ver `.ai/ARCHITECTURE.md` § Testing).
- Verificación manual: rutas mencionadas comprobadas contra el árbol real (`js/*.js`, `sw.js`, `manifest.webmanifest`, `docs/`, `ejemplos/`, `test/`); orden de scripts de `index.html` comprobado; `git status`/`git diff` confirman solo los 6 archivos nuevos de documentación más las ediciones documentales en `README.md` y `CONTRIBUTING.md` (ningún código, dependencia, `.ai/DECISIONS.md` ni `AGENTS.md` tocados en la pasada final).

## Pendientes / riesgos

- `POR CONFIRMAR` (marcado en `.ai/ARCHITECTURE.md`): versión exacta actual del campo `version` del formato; detalles de hosting/CDN del deploy; detalles del conector remoto MCP (viven en el repo hermano).
- Riesgo: `CONTRIBUTING.md` § "Estructura de archivos" no lista `js/deeplink.js` (añadido después); `AGENTS.md` y `ARCHITECTURE.md` sí lo incluyen. Cuando se toque CONTRIBUTING, alinearlo.
- **Hallazgos de documentación existente (reportados, no modificados, según regla de repo público)**:
  - `ideas.md` (en el repo, ya trackeado): menciona una métrica interna de tráfico («24 % de las visitas vienen de Estados Unidos») y una consideración sobre el plan de Umami. Es contenido preexistente del mantenedor: no se ha tocado; valorar fuera de esta tarea si conviene mantenerlo en el repo público.
  - `INFORME-*.md` y `PLAN-EJEMPLOS-NEGOCIO.md` viven en la carpeta padre `fluyo-new`, **fuera** del repo git: no se publican con el repositorio. Verificar que sigan así si se añade un remote o se mueven archivos.

## Handoff

### Estado actual

Los seis documentos están creados y validados, con los dos ajustes de alcance aplicados (repo público; revisable ≠ permanente). El sistema de contexto multiagente está operativo: sesión nueva = `AGENTS.md` + `.ai/tasks/<TASK>.md`.

### Próximo paso concreto

Commit y push de la documentación por parte del mantenedor (explícitamente fuera del alcance de esta tarea: no se ha hecho ningún commit). Pendiente fuera de FLUYO-001: `ideas.md` contiene la métrica interna de tráfico ya reportada; `CONTRIBUTING.md` referencia `INFORME-ICONOS-MARCA.md`, que vive fuera del repo.
