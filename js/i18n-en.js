"use strict";
/* FLUYO-I18N-001 / I18N-002 (S0) — English · lo COMÚN: Viewer, Present, Historia y páginas públicas (s/index.html y 404.html
   cargan solo este archivo; el editor, además, js/i18n-en-editor.js). Clave → texto; el español (idioma base) es el texto por
   defecto de cada llamada a FluyoI18n.t() y del HTML marcado con data-i18n*. Términos: glosario de .ai/tasks/FLUYO-I18N-001.md.
   Los tests de catálogo exigen solo claves en uso, con los mismos marcadores {param}, y que lo que usa el Viewer o el 404 esté
   aquí y no en el archivo del editor. */
var FLUYO_LOCALES=(typeof FLUYO_LOCALES==="object" && FLUYO_LOCALES) || {};
FLUYO_LOCALES.en=Object.assign(FLUYO_LOCALES.en || {}, {
  /* Historia (editor, Present y Viewer) */
  "story.group":"Story",
  "story.kicker":"Story · {name}",
  "story.playStory":"Play story",
  "story.replay":"Replay",
  "story.pause":"Pause",
  "story.resume":"Resume",
  "story.stop":"Stop",
  "story.paused":"Paused",
  "story.pausedCaption":"Paused · {caption}",
  "story.momentPrev":"Previous moment",
  "story.momentNext":"Next moment",

  /* Present (editor y Viewer) */
  "present.start":"Present",
  "present.pages":"Pages",
  "present.prev":"Previous",
  "present.next":"Next",
  "present.pagePrev":"Previous page",
  "present.pageNext":"Next page",
  "present.exit":"Exit",
  "present.exitLong":"Exit presentation",

  /* Viewer (/s/) */
  "viewer.docTitle":"Shared diagram · Fluyo",
  "viewer.pages":"Diagram pages",
  "viewer.page":"Diagram page",
  "viewer.fit":"Fit the diagram to the view",
  "view.zoomOut":"Zoom out",
  "view.zoomIn":"Zoom in",
  "viewer.presentHint":"Present the pages as slides",
  "viewer.open":"Open in Fluyo",
  "viewer.openShort":"Open",
  "viewer.openRest":"in Fluyo",
  "viewer.openHint":"Open an editable copy of this diagram in the editor",
  "viewer.madeWith":"Made with Fluyo",
  "viewer.loading":"Loading diagram…",
  "viewer.emptyPage":"This page has no elements.",
  "viewer.openFailed":"Couldn't prepare the editable copy. Please try again.",
  "viewer.error.invalidId":"The diagram link isn't valid.",
  "viewer.error.notFound":"This shared diagram isn't available.",
  "viewer.error.invalidDocument":"The shared document isn't a valid Fluyo diagram.",
  "viewer.error.unsupportedVersion":"This diagram needs a newer version of Fluyo.",
  "viewer.error.unavailable":"Couldn't load the diagram right now. Please try again later.",
  "page.untitled":"Page {n}",

  /* Páginas públicas sin idioma en la URL: cabecera y pie del shell, y el 404 (FLUYO-SHELL-001). Las páginas con URL
     propia (/privacy/, /support/…) llevan su texto escrito en su idioma y no usan el diccionario. */
  "shell.skip":"Skip to content",
  "shell.sections":"Sections",
  "shell.examples":"Examples",
  "shell.docs":"Docs",
  "shell.open":"Open Fluyo",
  "shell.license":"Fluyo · free software, MIT licence",
  "shell.legal":"Legal and project",
  "shell.privacy":"Privacy",
  "shell.terms":"Terms",
  "shell.support":"Support",
  "notfound.docTitle":"Page not found · Fluyo",
  "notfound.title":"This page doesn't exist",
  "notfound.body":"The link may be mistyped, or the page may no longer exist. Your diagrams are still in your browser.",
  "notfound.examples":"See examples",
  /* FLUYO-I18N-002 S2a · Historias: lo que lee también el Viewer (nombre de reserva y línea de la ruta observada) */
  "story.unnamed":"Unnamed element",
  "route.available":"Route available",
  "route.unavailable":"Route unavailable",
  "route.noPath":"No flow route",
  "route.byDefault":"includes default states",
  "route.withDefault":"{word} · {why}",
  /* FLUYO-I18N-002 S2b · el texto de la reproducción que compone el kernel (story-playback.js, con el proveedor de texto): lo leen
     Present, el Viewer y el editor */
  "story.finished":"Playback finished",
  "story.failedCount":{one:"{count} step couldn't run", other:"{count} steps couldn't run"},
  /* FLUYO-STORIES-2.0 S1b · el desenlace (FluyoStoryClock.outcomeText): editor, Present y Viewer */
  "story.outcome.ok":"Ends well",
  "story.outcome.failed":"Fails at step {n}",
  /* FLUYO-STORIES-2.0 S2a · «Otras formas»: las demás historias de la página, al terminar (Present y Viewer) */
  "story.others":"Other ways",
  "story.cap.down":"{name} is unavailable",
  "story.cap.up":"{name} is available again",
  "story.cap.failed":"Not completed · {name} is unavailable",
  "story.err.missingNode":"A step points to an element that no longer exists.",
  "story.err.missingEdge":"A step points to a connection that no longer exists.",
  "story.err.missingEdgeEndpoint":"A connection in the diagram has a lost endpoint.",
  "story.err.duplicateStructureId":"There are duplicate elements or connections.",
  "story.err.duplicateNodeId":"There are duplicate elements.",
  "story.err.duplicateEdgeId":"There are duplicate connections.",
  "story.err.unsupportedEngineVersion":"This story uses an unsupported playback version.",
  "story.err.guardExceeded":"The story exceeds an operational playback limit.",
  "story.err.invalidTimestamp":"A step has a time out of range.",
  "story.err.invalidStructure":"The page structure is not valid.",
  "story.err.invalidBehavior":"An element's initial state is not valid.",
  "story.err.invalidScenario":"The story has invalid data.",
  "story.err.invalidState":"A step has an invalid availability.",
  "story.err.unknownAction":"A step has an unknown action.",
  "story.err.duplicateStepId":"There are duplicate steps in the story.",
  "story.err.fallback":"Couldn't play. Review the story and check the technical details."
});
