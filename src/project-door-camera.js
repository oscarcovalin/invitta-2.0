(function(root){
  'use strict';
  class DoorCamera {
    constructor({video,canvas,onCode,onError}){Object.assign(this,{video,canvas,onCode,onError});this.stream=null;this.frame=0;this.generation=0;}
    async start(){
      this.stop();
      const generation=this.generation;
      try {
        if(typeof root.jsQR!=='function')throw Error('No se cargó el lector QR. Puedes ingresar el código manualmente.');
        const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'},audio:false});
        if(generation!==this.generation){stream.getTracks().forEach(t=>t.stop());return;}
        this.stream=stream;this.video.srcObject=stream;this.video.hidden=false;await this.video.play();
        if(generation===this.generation)this.scan();
      }catch(error){if(generation!==this.generation)return;this.stop();this.onError(error.name==='NotAllowedError'?'Cámara no autorizada. Usa el código manual.':error.message);}
    }
    scan(){
      if(!this.stream)return;
      if(this.video.readyState>=2){
        const scale=Math.min(1,640/this.video.videoWidth);
        this.canvas.width=Math.round(this.video.videoWidth*scale);this.canvas.height=Math.round(this.video.videoHeight*scale);
        const ctx=this.canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(this.video,0,0,this.canvas.width,this.canvas.height);
        const pixels=ctx.getImageData(0,0,this.canvas.width,this.canvas.height);
        const code=root.jsQR(pixels.data,pixels.width,pixels.height);
        if(code){this.stop();this.onCode(code.data);return;}
      }
      this.frame=requestAnimationFrame(()=>this.scan());
    }
    stop(){this.generation++;cancelAnimationFrame(this.frame);this.stream?.getTracks().forEach(t=>t.stop());this.stream=null;this.video.srcObject=null;this.video.hidden=true;}
  }
  root.DoorCamera=DoorCamera;
})(window);
