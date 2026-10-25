"use strict";
/* FLUYO-I18N-002 (S0) — English · solo el EDITOR (index.html). Lo común (Viewer, Present, Historia, páginas públicas) está en
   js/i18n-en.js; los dos archivos se suman en FLUYO_LOCALES.en. */
var FLUYO_LOCALES=(typeof FLUYO_LOCALES==="object" && FLUYO_LOCALES) || {};
FLUYO_LOCALES.en=Object.assign(FLUYO_LOCALES.en || {}, {
  /* Cabecera del editor */
  "editor.history":"Change history",
  "editor.undo":"Undo",
  "editor.undoHint":"Undo · Ctrl+Z",
  "editor.redo":"Redo",
  "editor.redoHint":"Redo · Ctrl+Y",
  "editor.mode":"Working mode",
  "editor.modeEdit":"Edit",
  "editor.modeStories":"Stories",
  "editor.canvas":"Canvas",
  "editor.canvasHint":"Canvas settings: theme, background, typography and grid",
  "editor.export":"Export",
  "editor.share":"Share",
  "editor.presentHint":"Present mode (P): full screen, one page per slide",
  "editor.properties":"Properties",
  "editor.more":"More options",

  /* Historia y Present del editor */
  "story.play":"Play",
  "present.playHint":"Play the story (Space)",
  "present.pauseHint":"Pause or resume (Space)",
  "present.stopHint":"Stop (Esc)",
  "present.pagePrevHint":"Previous page (←)",
  "present.pageNextHint":"Next page (→)",
  "present.exitHint":"Exit presentation (Esc)",
  "present.skinFlat":"Flat",
  "present.skinBuilt":"Built",
  "present.skinFlatHint":"Flat look · press B for the built look",
  "present.skinBuiltHint":"Built look (2.5D) · press B for the flat look",

  /* Historia · «Mensaje del paso…» (FLUYO-PRODUCT-NARRATION-001) */
  "step.message.nowReads":"Now it reads «{name}»",
  "step.message.helpSend":"Shown while this step plays, instead of the event's name. Timing doesn't change.",
  "step.message.helpElement":"Shown while this step plays and in its bubble, instead of the event's text. Timing doesn't change."
});
