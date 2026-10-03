const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { operatePass } = require('./lib/project-door-store.cjs');
const { createDoorHandler } = require('./lib/project-door-handler.cjs');
const secret = 'synthetic-test-only-door-signing-key-1234';
const projectId = randomUUID(), operationId = randomUUID(), guestId = randomUUID();
const config = { url: 'https://fixture.invalid', publishableKey: 'synthetic-public' };
const snapshot = { projectId, ticketId: operationId, guestId, name: 'Family', passes: 2,
  admitted: 0, remaining: 2, revoked: false, expiresAt: new Date().toISOString(), projectName: 'Local', tableName: null };
const issue = { action: 'issue', projectId, operationId, name: 'Family', passes: 2, immediate: false, tableId: null };
let calls = 0, rpcBody;
const fetchImpl = async (url, options) => {
  calls++; rpcBody = JSON.parse(options.body);
  assert.equal(options.headers.Authorization, 'Bearer synthetic-user-jwt');
  assert.equal(options.redirect, 'error');
  return { ok: true, json: async () => snapshot };
};
function response() { return { headers: {}, setHeader(k,v) { this.headers[k] = v; }, status(s) { this.statusCode = s; return this; }, json(v) { this.body = v; return this; } }; }
(async () => {
  const args = { input: issue, secret, config, accessToken: 'synthetic-user-jwt', fetchImpl };
  const result = await operatePass(args);
  assert.deepEqual((await operatePass({...args,input:{action:'context',projectId},fetchImpl:async()=>({ok:true,json:async()=>({projectName:'Local',canIssue:false,canAdmit:true})})})).context,
    {projectName:'Local',canIssue:false,canAdmit:true});
  assert.equal(result.pass.name, 'Family'); assert.match(result.credential, /^IV2\./);
  assert.equal(rpcBody.p_digest.length, 64); assert.equal(rpcBody.p_operation, operationId);
  assert.equal(rpcBody.p_name, 'Family'); assert.equal(rpcBody.p_immediate, false);
  for (const input of [{ ...issue, passes: 0 }, { ...issue, passes: 21 }, { ...issue, phone: 'ignored?' },
    { ...issue, operationId: 'bad' }, { ...issue, immediate: 'true' }, { ...issue, name: ' ' },
    { action: 'admit', projectId, credential: result.credential, operationId, count: 0 },
    { action: 'inspect', projectId: randomUUID(), credential: result.credential }]) {
    const before = calls;
    await assert.rejects(operatePass({ ...args, input }), e => e.status === 422);
    assert.equal(calls, before, 'Invalid input never reaches storage');
  }
  await assert.rejects(operatePass({ ...args, secret: undefined }), e => e.status === 503);
  await assert.rejects(operatePass({ ...args, fetchImpl: async () => { throw new Error('secret-network-details'); } }),
    e => e.status === 502 && !e.message.includes('secret-network-details'));
  await assert.rejects(operatePass({ ...args, fetchImpl: async () => ({ ok: true, json: async () => ({}) }) }), e => e.status === 502);
  for (const altered of [{...snapshot, ticketId:randomUUID()}, {...snapshot, projectId:randomUUID()}]) {
    await assert.rejects(operatePass({...args,fetchImpl:async()=>({ok:true,json:async()=>altered})}),e=>e.status===502,
      'A plausible result for another ticket/project is not a confirmation');
  }
  const admissionId=randomUUID();
  const admitArgs={...args,input:{action:'admit',projectId,credential:result.credential,operationId:admissionId,count:1}};
  const admission={ticketId:operationId,operationId:admissionId,count:1,admitted:1,remaining:1,confirmedAt:new Date().toISOString()};
  for (const altered of [{...admission,operationId:randomUUID()},{...admission,ticketId:randomUUID()},
    {...admission,count:2,admitted:2},{...admission,unexpected:'private data'}]) {
    await assert.rejects(operatePass({...admitArgs,fetchImpl:async()=>({ok:true,json:async()=>altered})}),e=>e.status===502);
  }
  for (const altered of [{ticketId:randomUUID(),revoked:true},{ticketId:operationId,revoked:true,unexpected:'private data'}]) {
    await assert.rejects(operatePass({...args,input:{action:'revoke',projectId,credential:result.credential},
      fetchImpl:async()=>({ok:true,json:async()=>altered})}),e=>e.status===502);
  }
  for (const [code,status] of [['42501',403],['P0001',409],['P0002',404],['23503',422],['23514',422]]) {
    await assert.rejects(operatePass({ ...args, fetchImpl: async () => ({ ok: false, status: 400, json: async () => ({code}) }) }), e => e.status === status);
  }
  const authService = { ACCESS_COOKIE: 'a', REFRESH_COOKIE: 'r', parseCookies: () => ({ a: 'synthetic-user-jwt' }),
    getAuthConfig: () => config, getAuthenticatedUser: async () => ({ id: guestId, email: 'local@invitta.test' }), isSecureRequest: () => true };
  let writes = 0;
  const handler = createDoorHandler({ authService, operate: async () => { writes++; return result; } });
  const req = { method: 'POST', headers: { origin:'https://fixture.invalid', host:'fixture.invalid', cookie:'a=x' }, body: issue };
  let res = response(); await handler(req,res); assert.equal(res.statusCode,201); assert.equal(writes,1);
  for (const origin of [undefined, 'https://evil.invalid', 'https://fixture.invalid/path']) {
    res = response(); await handler({ ...req, headers: { ...req.headers, origin } },res);
    assert.equal(res.statusCode,403); assert.equal(writes,1);
  }
  res = response(); await handler({ ...req, method:'GET' },res); assert.equal(res.statusCode,405);
  res = response(); await handler({ ...req, body:'x'.repeat(9000) },res); assert.equal(res.statusCode,422);
  const publicHandler = createDoorHandler({ authService, publicRead:true, operate: async args => {
    assert.equal(args.accessToken,config.publishableKey); return { pass: {name:'Family'} };
  } });
  res = response(); await publicHandler({method:'POST',headers:{},body:{credential:result.credential}},res);
  assert.equal(res.statusCode,200); assert.equal(res.headers['Cache-Control'],'no-store');
  console.log('PASS: door API validation, error states and private/public boundaries');
})().catch(e => { console.error(e); process.exitCode=1; });
