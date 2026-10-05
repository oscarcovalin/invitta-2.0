(function(root){
  'use strict';
  class DoorClient {
    constructor({projectId,storage,send,uuid=()=>crypto.randomUUID()}) {
      this.projectId=projectId;this.storage=storage;this.send=send;this.uuid=uuid;this.busy=false;
      this.key=`invitta-door-pending:${projectId}`;this.pending=null;
      const raw=storage.getItem(this.key);
      if(raw) {
        const saved=JSON.parse(raw);
        if(saved?.body?.projectId!==projectId || !['issue','admit','revoke'].includes(saved.body.action)) throw Error('Solicitud pendiente inválida. No se enviará.');
        this.pending=saved;
      }
    }
    persist(){if(this.pending)this.storage.setItem(this.key,JSON.stringify(this.pending));else this.storage.removeItem(this.key);}
    async write(input){
      if(this.pending)throw Error('Existe una solicitud pendiente. Verifica el reintento primero.');
      this.pending={body:{...input,projectId:this.projectId,...(['issue','admit'].includes(input.action)?{operationId:this.uuid()}: {})},uncertain:false};
      try { this.persist(); } catch (_) {this.pending=null;throw Error('No se puede conservar el reintento en esta pestaña. Habilita el almacenamiento de sesión.');}
      return this.retry();
    }
    async retry(){
      if(this.busy)throw Error('Solicitud procesando; espera su resultado.');
      if(!this.pending)throw Error('No hay solicitud pendiente.');
      this.busy=true;
      try {
        const result=await this.send(this.pending.body);
        if(result?.success!==true)throw Error('Resultado sin confirmar.');
        this.pending=null;this.persist();return result;
      } catch(error) {
        if(this.pending) {
          const definitive=[401,403,404,409,422,503].includes(error.status);
          if(definitive && !this.pending.uncertain)this.pending=null;
          else this.pending.uncertain=true;
          this.persist();
        }
        throw error;
      } finally {this.busy=false;}
    }
  }
  async function requestDoor(body,publicRead=false){
    let response,data;
    try {
      response=await fetch(publicRead?'/api/public/pass':'/api/projects/passes',{method:'POST',cache:'no-store',redirect:'error',
        credentials:publicRead?'omit':'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
      data=await response.json();
    } catch(_) {throw Error('Sin respuesta confirmada del servidor. No autorices el ingreso.');}
    if(!response.ok || data?.success!==true){const e=Error(data?.error || 'Resultado sin confirmar.');e.status=response.status;throw e;}
    return data;
  }
  const exported={DoorClient,requestDoor};
  if(typeof module!=='undefined'&&module.exports)module.exports=exported;else Object.assign(root,exported);
})(typeof window!=='undefined'?window:globalThis);
