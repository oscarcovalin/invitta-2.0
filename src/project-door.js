(async function(){
  'use strict';
  const $=id=>document.getElementById(id),projectId=new URL(location.href).searchParams.get('project');
  const status=(message,error=false)=>{$('status').textContent=message;$('status').dataset.kind=error?'error':'info';};
  let client,context,currentCredential='',issuedCredential='',camera,revoking='',inspection=0,currentRemaining=0;
  function lock(busy=false){
    const blocked=busy || !!client?.pending || !!revoking;
    $('issue-fields').disabled=blocked || !context?.canIssue;$('inspect-fields').disabled=blocked || !context;
    $('admit-fields').disabled=blocked || !currentCredential || currentRemaining===0;
    $('retry').hidden=!client?.pending;$('retry').disabled=busy;
    $('revoke').disabled=blocked;$('start-camera').disabled=blocked || !context;
    $('revoke-verified').hidden=!context?.canIssue;$('revoke-verified').disabled=blocked || !currentCredential;
  }
  function showPass(pass){
    currentRemaining=pass.remaining;
    $('holder').textContent=pass.name;$('table').textContent=pass.tableName?`Mesa: ${pass.tableName}`:'Sin mesa asignada';
    $('balance').textContent=`${pass.admitted} ingresados · ${pass.remaining} pases disponibles`;
    $('admit-form').elements.count.max=Math.min(20,pass.remaining);$('verified').hidden=false;
    $('admit-fields').disabled=!!client.pending || pass.remaining===0;
  }
  async function inspect(raw){
    camera?.stop();$('stop-camera').hidden=true;
    const sequence=++inspection;
    currentCredential='';$('verified').hidden=true;lock(true);
    try {
      let credential=raw.trim();
      if(!credential.startsWith('IV2.')){const url=new URL(credential);if(url.pathname!=='/pase.html' || url.origin!==location.origin)throw Error('Usa el enlace de un boleto de este sistema.');credential=url.hash.slice(1);}
      const data=await requestDoor({action:'inspect',projectId,credential});if(sequence!==inspection)return;currentCredential=credential;
      $('inspect-form').elements.credential.value=credential;lock();showPass(data.pass);status('Boleto válido. Confirma sólo las personas que ingresan ahora.');
    }catch(error){if(sequence!==inspection)return;status(error.message,true);lock();}
  }
  function issued(data){
    issuedCredential=data.credential;$('issued-name').textContent=`${data.pass.name} · ${data.pass.passes} pases · ingresados: ${data.pass.admitted}`;
    $('pass-link').value=new URL(`/pase.html#${data.credential}`,location.origin).href;
    $('qrcode').replaceChildren();
    if(typeof QRCode==='function')new QRCode($('qrcode'),{text:data.credential,width:256,height:256,correctLevel:QRCode.CorrectLevel.M});
    else $('qrcode').textContent='QR no disponible; conserva el enlace del boleto.';
    $('issued').hidden=false;
  }
  function result(data){
    if(data.credential){issued(data);status('Boleto emitido y confirmado en Supabase.');}
    else if(data.admission){
      currentCredential='';$('verified').hidden=true;lock();
      status(`Ingreso confirmado: ${data.admission.count} personas. Saldo al confirmar: ${data.admission.remaining}. Verifica de nuevo antes del siguiente grupo.`);
    }else if(data.revocation){$('issued').hidden=true;$('verified').hidden=true;currentCredential='';lock();status('Boleto revocado. Los ingresos anteriores se conservaron.');}
  }
  async function write(input,retry=false){
    camera?.stop();lock(true);status(retry?'Verificando la misma solicitud…':'Esperando confirmación del servidor…');
    try{const attempted=retry?client.pending.body:input;const data=await (retry?client.retry():client.write(input));
      if(attempted.action==='admit')$('inspect-form').elements.credential.value=attempted.credential;lock();result(data);}
    catch(error){status(error.message+(client.pending?' Conserva esta pestaña y verifica la solicitud pendiente.':''),true);lock();}
  }
  $('issue-form').addEventListener('submit',event=>{event.preventDefault();const form=event.target.elements;
    write({action:'issue',name:form.name.value,passes:Number(form.passes.value),tableId:form.tableId.value||null,immediate:form.immediate.checked});});
  $('inspect-form').addEventListener('submit',event=>{event.preventDefault();inspect(event.target.elements.credential.value);});
  $('admit-form').addEventListener('submit',event=>{event.preventDefault();write({action:'admit',credential:currentCredential,count:Number(event.target.elements.count.value)});});
  $('retry').addEventListener('click',()=>write(null,true));
  function askRevoke(credential){camera?.stop();revoking=credential;$('revoke-confirmation').hidden=false;lock();$('cancel-revoke').focus();}
  $('revoke').addEventListener('click',()=>askRevoke(issuedCredential));
  $('revoke-verified').addEventListener('click',()=>askRevoke(currentCredential));
  $('cancel-revoke').addEventListener('click',()=>{revoking='';$('revoke-confirmation').hidden=true;lock();});
  $('confirm-revoke').addEventListener('click',()=>{const credential=revoking;revoking='';$('revoke-confirmation').hidden=true;write({action:'revoke',credential});});
  $('copy-link').addEventListener('click',async()=>{try{await navigator.clipboard.writeText($('pass-link').value);status('Enlace copiado. No se ha enviado ningún mensaje.');}catch(_){$('pass-link').focus();$('pass-link').select();status('Selecciona y copia el enlace manualmente.');}});
  $('start-camera').addEventListener('click',async()=>{await camera.start();$('stop-camera').hidden=!camera.stream;});
  $('stop-camera').addEventListener('click',()=>{camera.stop();$('stop-camera').hidden=true;});
  addEventListener('pagehide',()=>camera?.stop());
  addEventListener('beforeunload',event=>{if(client?.pending){event.preventDefault();event.returnValue='';}});
  try{
    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(projectId||''))throw Error('Abre boletos y puerta desde la tarjeta de un proyecto. No se cargan datos de ejemplo.');
    client=new DoorClient({projectId,storage:sessionStorage,send:requestDoor});
    context=(await requestDoor({action:'context',projectId})).context;
    $('project-label').textContent=context.projectName;$('organizer').href=`organizador-mesas.html?project=${projectId}`;
    $('organizer').hidden=!context.canIssue;$('issuer').hidden=!context.canIssue;$('scanner').hidden=false;
    if(context.canIssue){
      let cursor=null;
      do{
        const params=new URLSearchParams({projectId,...(cursor?{cursor}: {})});
        const response=await fetch(`/api/projects/tables?${params}`,{cache:'no-store',redirect:'error'});const data=await response.json();
        if(!response.ok || !data.success)throw Error('No se pudieron cargar las mesas. Recarga antes de emitir.');
        for(const table of data.records){const option=document.createElement('option');option.value=table.id;option.textContent=table.name;$('issue-form').elements.tableId.append(option);}
        cursor=data.nextCursor;
      }while(cursor);
    }
    camera=new DoorCamera({video:$('scan-video'),canvas:$('scan-canvas'),onCode:code=>{ $('stop-camera').hidden=true;inspect(code);},onError:message=>status(message,true)});
    lock();status(client.pending?'Hay una solicitud pendiente. Verifícala antes de continuar.':'Proyecto autorizado. Puedes verificar un boleto.',!!client.pending);
  }catch(error){context=null;lock();status(error.message,true);}
})();
