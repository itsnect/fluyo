"use strict";
/* FLUYO-I18N-002 (S0) — 简体中文 · lo COMÚN (Viewer, Present, Historia, páginas públicas). Mismo formato que js/i18n-en.js.
   Código «zh», etiqueta zh-Hans (chino simplificado; zh-TW/zh-HK también llegan aquí). Idioma NO publicado
   (LANGS[].released=false en js/i18n.js): solo se ve con ?lang=zh; lo que falta cae al inglés. Pendiente de revisión nativa
   antes de publicarlo. Sin plurales, sin mayúsculas, puntuación de ancho completo (：，。“”（）). */
var FLUYO_LOCALES=(typeof FLUYO_LOCALES==="object" && FLUYO_LOCALES) || {};
FLUYO_LOCALES.zh=Object.assign(FLUYO_LOCALES.zh || {}, {
  /* Historia (editor, Present y Viewer) */
  "story.group":"故事",
  "story.kicker":"故事 · {name}",
  "story.playStory":"播放故事",
  "story.replay":"重播",
  "story.pause":"暂停",
  "story.resume":"继续",
  "story.stop":"停止",
  "story.paused":"已暂停",
  "story.pausedCaption":"已暂停 · {caption}",
  "story.momentPrev":"上一时刻",
  "story.momentNext":"下一时刻",

  /* Present (editor y Viewer) */
  "present.start":"演示",
  "present.pages":"页面",
  "present.prev":"上一个",
  "present.next":"下一个",
  "present.pagePrev":"上一页",
  "present.pageNext":"下一页",
  "present.exit":"退出",
  "present.exitLong":"退出演示",

  /* Viewer (/s/) */
  "viewer.docTitle":"共享的图表 · Fluyo",
  "viewer.pages":"图表页面列表",
  "viewer.page":"图表页面",
  "viewer.fit":"使图表适应视图",
  "view.zoomOut":"缩小",
  "view.zoomIn":"放大",
  "viewer.presentHint":"将页面作为幻灯片演示",
  "viewer.open":"在 Fluyo 中打开",
  "viewer.openShort":"打开",
  "viewer.openRest":"（Fluyo）",
  "viewer.openHint":"在编辑器中打开此图表的可编辑副本",
  "viewer.madeWith":"使用 Fluyo 制作",
  "viewer.loading":"正在加载图表…",
  "viewer.emptyPage":"此页面没有元素。",
  "viewer.openFailed":"无法准备可编辑副本。请重试。",
  "viewer.error.invalidId":"图表链接无效。",
  "viewer.error.notFound":"此共享图表不可用。",
  "viewer.error.invalidDocument":"共享的文档不是有效的 Fluyo 图表。",
  "viewer.error.unsupportedVersion":"此图表需要更新版本的 Fluyo。",
  "viewer.error.unavailable":"暂时无法加载图表。请稍后再试。",
  "page.untitled":"第 {n} 页",

  /* Páginas públicas: cabecera y pie del shell, y el 404 */
  "shell.skip":"跳到内容",
  "shell.sections":"栏目",
  "shell.examples":"示例",
  "shell.docs":"文档",
  "shell.open":"打开 Fluyo",
  "shell.license":"Fluyo · 自由软件，MIT 许可证",
  "shell.legal":"法律信息与项目",
  "shell.privacy":"隐私",
  "shell.terms":"条款",
  "shell.support":"支持",
  "notfound.docTitle":"找不到页面 · Fluyo",
  "notfound.title":"此页面不存在",
  "notfound.body":"链接可能有误，或该页面已不存在。你的图表仍保存在浏览器中。",
  "notfound.examples":"查看示例"
});
