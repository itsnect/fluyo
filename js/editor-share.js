"use strict";
/* Confirmación y resultado locales. No persiste ni sube documentos. */
const shareDialog=document.getElementById("shareDialog");
const shareControl=id=>document.getElementById(id);
let shareBusy=false;
function showShareDialog(){
  if(typeof isScenarioPlaybackActive==="function" && isScenarioPlaybackActive()){
    shareControl("shareMessage").textContent="Finaliza el Scenario con Reset antes de compartir.";
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
  const web=["http:","https:"].includes(location.protocol);
  shareControl("shareMessage").textContent=web? "" : "Compartir mediante enlace requiere abrir Fluyo desde su versión web.";
  shareControl("shareCreate").disabled=!web;
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
    const url=await createShareUrl(project,location.href);
    shareControl("shareLink").value=url;
    shareControl("shareConfirm").hidden=true;
    shareControl("shareResult").hidden=false;
    shareControl("shareCreate").hidden=true;
    shareControl("shareCopy").hidden=false;
    shareControl("shareClose").textContent="Cerrar";
    shareControl("shareMessage").textContent="";
    trackEvent("share_created");
    shareControl("shareCopy").focus();
  }catch(e){
    shareControl("shareMessage").textContent=e.code==="too_large" && e.stage==="url"
      ? "Este diagrama es demasiado grande para compartir mediante enlace. Puedes exportarlo como archivo por ahora."
      : e.code==="web_required"
        ? "Compartir mediante enlace requiere abrir Fluyo desde su versión web."
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
