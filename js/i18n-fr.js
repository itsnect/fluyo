"use strict";
/* FLUYO-I18N-002 (S0) — Français · lo COMÚN (Viewer, Present, Historia, páginas públicas). Mismo formato que js/i18n-en.js.
   Idioma NO publicado (LANGS[].released=false en js/i18n.js): solo se ve con ?lang=fr; lo que falta cae al inglés. Pendiente de
   revisión nativa antes de publicarlo. Tipografía francesa: espacio insecable (U+00A0) antes de «:» y fino (U+202F) dentro de
   « » y antes de ; ! ?. */
var FLUYO_LOCALES=(typeof FLUYO_LOCALES==="object" && FLUYO_LOCALES) || {};
FLUYO_LOCALES.fr=Object.assign(FLUYO_LOCALES.fr || {}, {
  /* Historia (editor, Present y Viewer) */
  "story.group":"Histoire",
  "story.kicker":"Histoire · {name}",
  "story.playStory":"Lire l'histoire",
  "story.replay":"Rejouer",
  "story.pause":"Pause",
  "story.resume":"Reprendre",
  "story.stop":"Arrêter",
  "story.paused":"En pause",
  "story.pausedCaption":"En pause · {caption}",
  "story.momentPrev":"Moment précédent",
  "story.momentNext":"Moment suivant",

  /* Present (editor y Viewer) */
  "present.start":"Présenter",
  "present.pages":"Pages",
  "present.prev":"Précédent",
  "present.next":"Suivant",
  "present.pagePrev":"Page précédente",
  "present.pageNext":"Page suivante",
  "present.exit":"Quitter",
  "present.exitLong":"Quitter la présentation",

  /* Viewer (/s/) */
  "viewer.docTitle":"Diagramme partagé · Fluyo",
  "viewer.pages":"Pages du diagramme",
  "viewer.page":"Page du diagramme",
  "viewer.fit":"Ajuster le diagramme à la vue",
  "view.zoomOut":"Zoom arrière",
  "view.zoomIn":"Zoom avant",
  "viewer.presentHint":"Présenter les pages comme des diapositives",
  "viewer.open":"Ouvrir dans Fluyo",
  "viewer.openShort":"Ouvrir",
  "viewer.openRest":"dans Fluyo",
  "viewer.openHint":"Ouvrir une copie modifiable de ce diagramme dans l'éditeur",
  "viewer.madeWith":"Créé avec Fluyo",
  "viewer.loading":"Chargement du diagramme…",
  "viewer.emptyPage":"Cette page ne contient aucun élément.",
  "viewer.openFailed":"Impossible de préparer la copie modifiable. Réessayez.",
  "viewer.error.invalidId":"Le lien du diagramme n'est pas valide.",
  "viewer.error.notFound":"Ce diagramme partagé n'est pas disponible.",
  "viewer.error.invalidDocument":"Le document partagé n'est pas un diagramme Fluyo valide.",
  "viewer.error.unsupportedVersion":"Ce diagramme nécessite une version plus récente de Fluyo.",
  "viewer.error.unavailable":"Impossible de charger le diagramme pour le moment. Réessayez plus tard.",
  "page.untitled":"Page {n}",

  /* Páginas públicas: cabecera y pie del shell, y el 404 */
  "shell.skip":"Aller au contenu",
  "shell.sections":"Sections",
  "shell.examples":"Exemples",
  "shell.docs":"Docs",
  "shell.open":"Ouvrir Fluyo",
  "shell.license":"Fluyo · logiciel libre, licence MIT",
  "shell.legal":"Mentions légales et projet",
  "shell.privacy":"Confidentialité",
  "shell.terms":"Conditions",
  "shell.support":"Assistance",
  "notfound.docTitle":"Page introuvable · Fluyo",
  "notfound.title":"Cette page n'existe pas",
  "notfound.body":"Le lien est peut-être mal saisi, ou la page n'existe plus. Vos diagrammes sont toujours dans votre navigateur.",
  "notfound.examples":"Voir les exemples"
});
