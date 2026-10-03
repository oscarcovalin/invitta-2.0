const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
let release,stopped=0,frames=0;
const video={hidden:true,srcObject:null,play:async()=>{},readyState:0};
const context={window:{jsQR:()=>null},navigator:{mediaDevices:{getUserMedia:()=>new Promise(r=>{release=r;})}},cancelAnimationFrame(){},requestAnimationFrame(){frames++;return 1;}};
vm.createContext(context);vm.runInContext(fs.readFileSync('src/project-door-camera.js','utf8'),context);
(async()=>{
  assert.match(fs.readFileSync('puerta-proyecto.html','utf8'),/<button id="start-camera" disabled>/,
    'Camera action starts disabled until permissions/tables/controller initialization finish');
  const camera=new context.window.DoorCamera({video,canvas:{},onCode(){},onError(){}});
  const starting=camera.start();camera.stop();release({getTracks:()=>[{stop(){stopped++;}}]});await starting;
  assert.equal(stopped,1,'Late camera permission stream immediately closes after stop');
  assert.equal(camera.stream,null);assert.equal(video.srcObject,null);assert.equal(video.hidden,true);assert.equal(frames,0);
  console.log('PASS: late camera permission cannot restart a stopped scanner');
})().catch(e=>{console.error(e);process.exitCode=1;});
