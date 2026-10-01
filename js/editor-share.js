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
function showShareDialog(){
  if(typeof isScenarioPlaybackActive==="function" && isScenarioPlaybackActive()){
    shareControl("shareMessage").textContent=typeof scStatus!=="undefined" && scStatus==="completed"
      ?"Pulsa «Volver a editar» antes de compartir."
      :"Detén la reproducción de la historia antes de compartir.";
    shareControl("shareConfirm").hidden=true;
    shareControl("shareResult").hidden=true;
    shareControl("shareCreate").hidden=true;
    shareControl("shareCopy").hidden=true;
    shareControl("shareClose").textContent="Cerrar";
    shareDialog.showModal();
    return;
  }
  commitEditBox();
  shareControl("shareConfirm").hidden=false;
  shareControl("shareResult").hidden=true;
  shareControl("shareCopy").hidden=true;
  shareControl("shareCreate").hidden=false;
  shareControl("shareCreate").disabled=false;
  shareControl("shareClose").textContent="Cancelar";
  shareControl("shareLink").value="";
  const story=shareStory();
  shareControl("shareKind").hidden=!story;
  shareControl("shareTitle").textContent=story?"Compartir":"Compartir diagrama";
  if(story){
    shareControl("shareStoryName").textContent=story.name;
    shareControl("shareKindStory").checked=true;
    shareControl("shareKindDiagram").checked=false;
  }
  /* Desde un archivo local el enlace apunta al visor público: se avisa, no se bloquea. */
  shareControl("shareMessage").textContent=isWebOrigin(location.href)? "" : "Estás usando Fluyo desde un archivo local: el enlace se creará para el visor público (fluyo.space).";
  shareDialog.showModal();
}
async function confirmShare(){
  if(shareBusy || shareControl("shareCreate").disabled || !shareDialog.open) return;
  shareBusy=true;
  shareControl("shareCreate").disabled=true;
  shareControl("shareClose").disabled=true;
  shareControl("shareMessage").textContent="Creando enlace…";
  try{
    commitEditBox();
    let project;
    try{project=serializeProject();}catch{throw shareUrlError("serialization_failed");}
    const kind=selectedShareKind(), story=shareStory();
    /* La unidad que se comparte es la Historia seleccionada; sin Historia con momentos, sólo el diagrama. */
    const url=await createShareUrl(project,location.href,story?{kind,scenarioId:story.id}:{kind:"diagram"});
    shareControl("shareResultNote").textContent=kind==="story"&&story
      ?"Quien abra este enlace verá el diagrama y podrá reproducir la historia. Los cambios posteriores no modificarán este enlace."
      :"Este enlace contiene una copia del diagrama actual. Los cambios posteriores no modificarán este enlace.";
    shareControl("shareLink").value=url;
    shareControl("shareConfirm").hidden=true;
    shareControl("shareResult").hidden=false;
    shareControl("shareCreate").hidden=true;
    shareControl("shareCopy").hidden=false;
    shareControl("shareClose").textContent="Cerrar";
    shareControl("shareMessage").textContent=isWebOrigin(location.href)? "" : "El enlace abre el visor público de fluyo.space.";
    trackEvent("share_created");
    shareControl("shareCopy").focus();
  }catch(e){
    shareControl("shareMessage").textContent=e.code==="too_large" && e.stage==="url"
      ? "Este diagrama es demasiado grande para compartir mediante enlace. Puedes exportarlo como archivo por ahora."
      : "No se pudo crear el enlace. Puedes exportar el diagrama como archivo.";
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
    shareControl("shareMessage").textContent="Enlace copiado.";
  }catch(e){
    field.focus(); field.select();
    shareControl("shareMessage").textContent="No se pudo copiar automáticamente. Selecciona y copia el enlace manualmente.";
  }
}
shareControl("btnShare").onclick=showShareDialog;
shareControl("shareCreate").onclick=confirmShare;
shareControl("shareCopy").onclick=copyShareLink;
shareControl("shareClose").onclick=()=>shareDialog.close();
shareDialog.addEventListener("cancel",ev=>{ if(shareBusy) ev.preventDefault(); });
shareDialog.addEventListener("keydown",ev=>{
  // Los atajos del editor no editan el canvas mientras el diálogo tiene foco.
  ev.stopPropagation();
});
