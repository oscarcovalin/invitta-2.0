const assert=require('node:assert/strict');
(async()=>{
  const {default:middleware,config}=await import('./middleware.js');
  assert(config.matcher.includes('/puerta-proyecto.html'),'Deployment matcher must activate the door guard');
  const saved={fetch:global.fetch,url:process.env.SUPABASE_URL,key:process.env.SUPABASE_PUBLISHABLE_KEY};
  process.env.SUPABASE_URL='https://fixture.supabase.co';process.env.SUPABASE_PUBLISHABLE_KEY='synthetic-public';
  try{
    global.fetch=async()=>({ok:true,json:async()=>({id:'verified-user',email:'local@invitta.test'})});
    for(const path of ['puerta-proyecto.html?project=synthetic','generador-emergencia.html?project=synthetic','scanner-acceso.html?project=synthetic']){
      const url=`https://invitta.test/${path}`;
      const denied=await middleware(new Request(url));assert.equal(denied.status,302);
      const authorized=await middleware(new Request(url,{headers:{cookie:'invitta_access_token=synthetic'}}));
      if(path.startsWith('puerta'))assert.equal(authorized,undefined);
      else {assert.equal(authorized.status,307);assert.equal(new URL(authorized.headers.get('location')).pathname,'/puerta-proyecto.html');}
    }
    assert.equal(await middleware(new Request('https://invitta.test/pase.html#synthetic')),undefined,'Bearer pass is public; not editor');
  }finally{global.fetch=saved.fetch;for(const [k,v]of [['SUPABASE_URL',saved.url],['SUPABASE_PUBLISHABLE_KEY',saved.key]]){if(v===undefined)delete process.env[k];else process.env[k]=v;}}
  console.log('PASS: verified door session and project-mode legacy redirects');
})().catch(e=>{console.error(e);process.exitCode=1;});
