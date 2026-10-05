(async function(){
  'use strict';
  const $=id=>document.getElementById(id);
  try{
    const credential=location.hash.slice(1);
    if(!credential.startsWith('IV2.'))throw Error('Este enlace no contiene un boleto válido.');
    const {pass}=await requestDoor({credential},true);
    $('name').textContent=pass.name;$('event').textContent=pass.projectName;
    $('table').textContent=pass.tableName?`Mesa: ${pass.tableName}`:'Sin mesa asignada';
    $('balance').textContent=`${pass.passes} pases · ${pass.remaining} disponibles`;
    $('expiry').textContent=`Válido hasta ${new Date(pass.expiresAt).toLocaleString('es-MX')}`;
    if(typeof QRCode==='function')new QRCode($('qrcode'),{text:credential,width:256,height:256,correctLevel:QRCode.CorrectLevel.M});
    $('status').textContent='Boleto válido.';$('pass').hidden=false;
  }catch(error){$('status').textContent=error.message;$('status').dataset.kind='error';}
})();
