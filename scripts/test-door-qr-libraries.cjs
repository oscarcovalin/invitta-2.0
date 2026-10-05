'use strict';
// Verifies the exact existing CDN versions/SRI and QR matrix interoperability.
// No user data, Auth token, key, install or remote database is involved.
const assert=require('node:assert/strict');
const {createHash,randomUUID}=require('node:crypto');
const {readFile}=require('node:fs/promises');
const {resolve}=require('node:path');
const vm=require('node:vm');
const {signCredential}=require('../lib/door-credential.cjs');
const libs=[
 ['https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js','sha384-3zSEDfvllQohrq0PHL1fOXJuC/jSOO34H46t6UQfobFOmxE5BpjjaIJY5F2/bMnU'],
 ['https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js','sha384-b5Ya4Bq3qCyz39m2ISh+4DxjAIljdeFwK/BsXLuj9gugaNwAcj/ia15fxNZL9Nlx']
];
async function main(){
 const sources=[];
 for(const [url,integrity] of libs){
  const response=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(20000)});
  assert(response.ok,'Pinned public QR library available');
  const bytes=Buffer.from(await response.arrayBuffer());
  assert.equal('sha384-'+createHash('sha384').update(bytes).digest('base64'),integrity,'Downloaded bytes match pinned SRI');
  sources.push(bytes.toString('utf8'));
 }
 const page=await readFile(resolve(__dirname,'../puerta-proyecto.html'),'utf8');
 for(const [url,integrity] of libs) assert(page.includes(`src="${url}" integrity="${integrity}" crossorigin="anonymous"`));
 const node=()=>({style:{},childNodes:[{style:{}}],appendChild(){},setAttribute(){}});
 const context=vm.createContext({document:{documentElement:{tagName:'HTML'},createElement:node},navigator:{userAgent:''}});
 context.window=context;
 vm.runInContext(sources[0],context,{timeout:3000});
 const decoder={module:{exports:{}},exports:{}};vm.createContext(decoder);
 vm.runInContext(sources[1],decoder,{timeout:3000});
 for(let attempt=0;attempt<5;attempt++){
  const credential=signCredential(randomUUID(),randomUUID(),'synthetic-library-check-only-key-123456');
  const qr=new context.QRCode(node(),{text:credential,width:256,height:256,correctLevel:context.QRCode.CorrectLevel.M});
  const matrix=qr._oQRCode, count=matrix.getModuleCount(), scale=5, border=4, size=(count+border*2)*scale;
  const pixels=new Uint8ClampedArray(size*size*4);pixels.fill(255);
  for(let y=0;y<count;y++)for(let x=0;x<count;x++)if(matrix.isDark(y,x)){
   for(let dy=0;dy<scale;dy++)for(let dx=0;dx<scale;dx++){
    const p=(((y+border)*scale+dy)*size+(x+border)*scale+dx)*4;
    pixels[p]=pixels[p+1]=pixels[p+2]=0;
   }
  }
  const decoded=decoder.module.exports(pixels,size,size);
  assert(decoded && decoded.data===credential,'Pinned encoder matrix decodes to the exact signed credential');
 }
 console.log('PASS: five signed QR matrices decode exactly; both CDN libraries match pinned SRI');
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
