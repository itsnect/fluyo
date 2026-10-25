"use strict";
/* FLUYO-I18N-002 (S0) — 日本語 · lo COMÚN (Viewer, Present, Historia, páginas públicas). Mismo formato que js/i18n-en.js.
   Idioma NO publicado (LANGS[].released=false en js/i18n.js): solo se ve con ?lang=ja; lo que falta cae al inglés. Pendiente de
   revisión nativa antes de publicarlo. Sin plurales (Intl.PluralRules("ja") solo tiene «other»), sin mayúsculas, puntuación de
   ancho completo (：、。「」（）). */
var FLUYO_LOCALES=(typeof FLUYO_LOCALES==="object" && FLUYO_LOCALES) || {};
FLUYO_LOCALES.ja=Object.assign(FLUYO_LOCALES.ja || {}, {
  /* Historia (editor, Present y Viewer) */
  "story.group":"ストーリー",
  "story.kicker":"ストーリー · {name}",
  "story.playStory":"ストーリーを再生",
  "story.replay":"もう一度再生",
  "story.pause":"一時停止",
  "story.resume":"再開",
  "story.stop":"停止",
  "story.paused":"一時停止中",
  "story.pausedCaption":"一時停止中 · {caption}",
  "story.momentPrev":"前の場面",
  "story.momentNext":"次の場面",

  /* Present (editor y Viewer) */
  "present.start":"プレゼン",
  "present.pages":"ページ",
  "present.prev":"前へ",
  "present.next":"次へ",
  "present.pagePrev":"前のページ",
  "present.pageNext":"次のページ",
  "present.exit":"終了",
  "present.exitLong":"プレゼンを終了",

  /* Viewer (/s/) */
  "viewer.docTitle":"共有されたダイアグラム · Fluyo",
  "viewer.pages":"ダイアグラムのページ一覧",
  "viewer.page":"ダイアグラムのページ",
  "viewer.fit":"ダイアグラムを画面に合わせる",
  "view.zoomOut":"縮小",
  "view.zoomIn":"拡大",
  "viewer.presentHint":"ページをスライドとしてプレゼン",
  "viewer.open":"Fluyo で開く",
  "viewer.openShort":"開く",
  "viewer.openRest":"（Fluyo）",
  "viewer.openHint":"このダイアグラムの編集用コピーをエディタで開く",
  "viewer.madeWith":"Fluyo で作成",
  "viewer.loading":"ダイアグラムを読み込み中…",
  "viewer.emptyPage":"このページには要素がありません。",
  "viewer.openFailed":"編集用コピーを準備できませんでした。もう一度お試しください。",
  "viewer.error.invalidId":"ダイアグラムのリンクが無効です。",
  "viewer.error.notFound":"この共有ダイアグラムは利用できません。",
  "viewer.error.invalidDocument":"共有されたドキュメントは有効な Fluyo ダイアグラムではありません。",
  "viewer.error.unsupportedVersion":"このダイアグラムには新しいバージョンの Fluyo が必要です。",
  "viewer.error.unavailable":"現在ダイアグラムを読み込めません。しばらくしてからもう一度お試しください。",
  "page.untitled":"ページ {n}",

  /* Páginas públicas: cabecera y pie del shell, y el 404 */
  "shell.skip":"本文へ移動",
  "shell.sections":"セクション",
  "shell.examples":"サンプル",
  "shell.docs":"ドキュメント",
  "shell.open":"Fluyo を開く",
  "shell.license":"Fluyo · 自由ソフトウェア、MIT ライセンス",
  "shell.legal":"法的情報とプロジェクト",
  "shell.privacy":"プライバシー",
  "shell.terms":"利用規約",
  "shell.support":"サポート",
  "notfound.docTitle":"ページが見つかりません · Fluyo",
  "notfound.title":"このページは存在しません",
  "notfound.body":"リンクが間違っているか、ページが削除された可能性があります。ダイアグラムはブラウザに残っています。",
  "notfound.examples":"サンプルを見る"
});
