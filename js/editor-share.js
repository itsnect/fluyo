"use strict";
/* Confirmación y resultado locales. No persiste ni sube documentos. */
const shareDialog=document.getElementById("shareDialog");
const shareControl=id=>document.getElementById(id);
let shareBusy=false;
/* Historia que viajaría en el enlace: la Historia seleccionada de la página, si tiene pasos. */
function shareStory(){
  if(typeof scActiveScenario!=="function") return null;
  const sc=scActiveScenario();
  return sc && sc.steps.length ? sc : null;
}
function selectedShareKind(){
  return shareStory() && shareControl("shareKindDiagram").checked ? "diagram" : "story";
}
/* FLUYO-STORIES-2.0 S2a (D3): las «otras formas» de la Historia, las demás Historias con pasos de su página, en su orden (la familia
   es la página, D1). Viajan con ella si la casilla sigue marcada; marcada cada vez que se abre el diálogo. */
function shareOthers(story){
  return story ? P().scenarios.filter(s=>s!==story && s.steps.length>0) : [];
}
function shareWithOthers(story){
  return !!story && selectedShareKind()==="story" && shareOthers(story).length>0 && shareControl("shareOthers").checked;
}
/* Un enlace que no cabe con la familia se intenta solo con la Historia (lo dice el diálogo). */
const shareTooBig=e=>(e.code==="too_large" && e.stage==="url") || e.reason==="uncompressed_limit";
/* FLUYO-I18N-002 S1: los textos del diálogo que dependen del estado se guardan como función y se pintan con shareText(): así,
   si el idioma cambia con el diálogo abierto, se repintan en el nuevo (onChange, abajo). El nombre de la Historia es contenido
   del autor: viaja como parámetro y nunca se traduce. */
const shareTexts={};
function shareText(id, fn, prop="textContent"){
  shareTexts[id]={paint:()=>{ shareControl(id)[prop]=fn(); }};
  shareTexts[id].paint();
}
/* La frase de «Compartir historia»: la plantilla se traduce ENTERA y el nombre (contenido del autor) va en su propio nodo, sin
   reinterpretarse, como siempre: «…suceder: «» · nombre · «».». */
function shareStoryHint(name){
  shareTexts.shareStoryName={paint:()=>{
    const parts=FluyoI18n.t("share.storyHint","Quien abra el enlace podrá verla suceder: «{name}».",{name:"\u0000"}).split("\u0000");
    const span=document.createElement("span"); span.textContent=name;
    shareControl("shareStoryName").replaceChildren(document.createTextNode(parts[0]), span, document.createTextNode(parts.slice(1).join("")));
  }};
  shareTexts.shareStoryName.paint();
}
function showShareDialog(){
  if(typeof isScenarioPlaybackActive==="function" && isScenarioPlaybackActive()){
    const done=typeof scStatus!=="undefined" && scStatus==="completed";
    shareText("shareMessage", ()=>done
      ?FluyoI18n.t("share.stopFirst","Pulsa «Detener» antes de compartir.")
      :FluyoI18n.t("share.stopPlayback","Detén la reproducción de la historia antes de compartir."));
    shareControl("shareConfirm").hidden=true;
    shareControl("shareResult").hidden=true;
    shareControl("shareCreate").hidden=true;
    shareControl("shareCopy").hidden=true;
    shareText("shareClose", ()=>FluyoI18n.t("common.close","Cerrar"));
    shareDialog.showModal();
    return;
  }
  commitEditBox();
  shareControl("shareConfirm").hidden=false;
  shareControl("shareResult").hidden=true;
  shareControl("shareCopy").hidden=true;
  shareControl("shareCreate").hidden=false;
  shareControl("shareCreate").disabled=false;
  shareText("shareClose", ()=>FluyoI18n.t("common.cancel","Cancelar"));
  shareControl("shareLink").value="";
  const story=shareStory();
  shareControl("shareKind").hidden=!story;
  shareText("shareTitle", ()=>story?FluyoI18n.t("share.title","Compartir"):FluyoI18n.t("share.titleDiagram","Compartir diagrama"));
  if(story){
    shareStoryHint(story.name);
    shareControl("shareKindStory").checked=true;
    shareControl("shareKindDiagram").checked=false;
  }
  const others=shareOthers(story);
  shareControl("shareOthersRow").hidden=!others.length;
  shareControl("shareOthers").checked=true;
  /* los nombres son contenido del autor: cada uno en su propio nodo, sin traducir (como el de la Historia) */
  const names=shareControl("shareOthersNames");
  names.textContent="";
  others.forEach((s,i)=>{
    if(i) names.appendChild(document.createTextNode(" · "));
    const span=document.createElement("span"); span.textContent=s.name; names.appendChild(span);
  });
  /* Desde un archivo local el enlace apunta al visor público: se avisa, no se bloquea. */
  shareText("shareMessage", ()=>isWebOrigin(location.href)? "" : FluyoI18n.t("share.localFile","Estás usando Fluyo desde un archivo local: el enlace se creará para el visor público (fluyo.space)."));
  shareDialog.showModal();
}
async function confirmShare(){
  if(shareBusy || shareControl("shareCreate").disabled || !shareDialog.open) return;
  shareBusy=true;
  shareControl("shareCreate").disabled=true;
  shareControl("shareClose").disabled=true;
  shareText("shareMessage", ()=>FluyoI18n.t("share.creating","Creando enlace…"));
  try{
    commitEditBox();
    let project;
    try{project=serializeProject();}catch{throw shareUrlError("serialization_failed");}
    const kind=selectedShareKind(), story=shareStory();
    let withOthers=shareWithOthers(story), dropped=false;
    /* La unidad que se comparte es la Historia seleccionada (con sus otras formas detrás, S2a); sin Historia con momentos, sólo el diagrama. */
    let url;
    try{url=await createShareUrl(project,location.href,story?{kind,scenarioId:story.id,withOthers}:{kind:"diagram"});}
    catch(e){
      if(!withOthers || !shareTooBig(e)) throw e;
      withOthers=false; dropped=true;
      url=await createShareUrl(project,location.href,{kind,scenarioId:story.id});
    }
    shareText("shareResultNote", ()=>kind==="story"&&story
      ?(withOthers
        ?FluyoI18n.t("share.noteStoryOthers","Quien abra este enlace verá el diagrama y podrá reproducir la historia y sus otras formas. Los cambios posteriores no modificarán este enlace.")
        :FluyoI18n.t("share.noteStory","Quien abra este enlace verá el diagrama y podrá reproducir la historia. Los cambios posteriores no modificarán este enlace."))
      :FluyoI18n.t("share.noteDiagram","Este enlace contiene una copia del diagrama actual. Los cambios posteriores no modificarán este enlace."));
    shareControl("shareLink").value=url;
    shareControl("shareConfirm").hidden=true;
    shareControl("shareResult").hidden=false;
    shareControl("shareCreate").hidden=true;
    shareControl("shareCopy").hidden=false;
    shareText("shareClose", ()=>FluyoI18n.t("common.close","Cerrar"));
    shareText("shareMessage", ()=>dropped
      ?FluyoI18n.t("share.othersTooLarge","Con sus otras formas el enlace era demasiado grande: solo viaja esta historia.")
      :isWebOrigin(location.href)? "" : FluyoI18n.t("share.publicViewer","El enlace abre el visor público de fluyo.space."));
    trackEvent("share_created");
    shareControl("shareCopy").focus();
  }catch(e){
    const tooLarge=e.code==="too_large" && e.stage==="url";
    shareText("shareMessage", ()=>tooLarge
      ? FluyoI18n.t("share.tooLarge","Este diagrama es demasiado grande para compartir mediante enlace. Puedes exportarlo como archivo por ahora.")
      : FluyoI18n.t("share.failed","No se pudo crear el enlace. Puedes exportar el diagrama como archivo."));
    shareControl("shareCreate").disabled=false;
  }finally{
    shareBusy=false;
    shareControl("shareClose").disabled=false;
  }
}
async function copyShareLink(){
  const field=shareControl("shareLink");
  if(!field.value) return;
  try{
    if(typeof navigator.clipboard?.writeText!=="function") throw new Error("clipboard_unavailable");
    await navigator.clipboard.writeText(field.value);
    shareText("shareMessage", ()=>FluyoI18n.t("share.copied","Enlace copiado."));
  }catch(e){
    field.focus(); field.select();
    shareText("shareMessage", ()=>FluyoI18n.t("share.copyFailed","No se pudo copiar automáticamente. Selecciona y copia el enlace manualmente."));
  }
}
/* Cambio de idioma en vivo con el diálogo abierto: cada texto pintado se vuelve a pintar en el nuevo idioma. */
FluyoI18n.onChange(()=>{ for(const t of Object.values(shareTexts)) t.paint(); });
shareControl("btnShare").onclick=showShareDialog;
shareControl("shareCreate").onclick=confirmShare;
shareControl("shareCopy").onclick=copyShareLink;
shareControl("shareClose").onclick=()=>shareDialog.close();
shareDialog.addEventListener("cancel",ev=>{ if(shareBusy) ev.preventDefault(); });
shareDialog.addEventListener("keydown",ev=>{
  // Los atajos del editor no editan el canvas mientras el diálogo tiene foco.
  ev.stopPropagation();
});
