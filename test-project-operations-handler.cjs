'use strict';
const assert = require('node:assert/strict');
const auth = require('./lib/supabase-auth-service.cjs');
const { createProjectOperationsHandler } = require('./lib/project-operations-handler.cjs');
const projectId = '10000000-0000-4000-8000-000000000001';
const id = '20000000-0000-4000-8000-000000000001';
const authService = { ...auth, getAuthConfig: () => ({ url: 'https://test.invalid', publishableKey: 'public-test' }),
  getAuthenticatedUser: async ({ accessToken }) => { if (accessToken !== 'valid') throw new auth.AuthServiceError('UNAUTHENTICATED', 'expired', 401); return { id, is_anonymous: false }; },
  refreshAuthSession: async () => ({ accessToken: 'valid', refreshToken: 'rotated', expiresIn: 60, user: { id } }) };
const req = (method = 'GET') => ({ method, headers: { cookie: 'invitta_access_token=valid', host: 'localhost:8080', origin: 'http://localhost:8080' }, query: { projectId }, body: { projectId, id, name: 'Test', passes: 1 } });
async function call(request, service = authService, operate = async args => ({ args })) {
  const response = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(n) { this.statusCode = n; return this; }, json(v) { this.body = v; return this; } };
  await createProjectOperationsHandler({ authService: service, operate, resource: 'guests' })(request, response);
  return response;
}
(async () => {
  assert.equal((await call(req())).body.args.userId, id);
  assert.equal((await call(req('POST'))).statusCode, 201);
  assert.equal((await call(req('PATCH'))).statusCode, 200);
  for (const origin of [undefined, 'null', 'http://evil.test', 'http://localhost:8080/path', 'https://localhost:8080']) {
    const request = req('POST'); request.headers.origin = origin;
    let written = false;
    const result = await call(request, authService, async () => { written = true; });
    assert.equal(result.statusCode, 403); assert.equal(written, false);
  }
  const missing = req(); missing.headers.cookie = '';
  assert.equal((await call(missing)).statusCode, 401);
  const anonymous = await call(req(), { ...authService, getAuthenticatedUser: async () => ({ id, is_anonymous: true }) });
  assert.equal(anonymous.statusCode, 403);
  const refreshed = req(); refreshed.headers.cookie = 'invitta_access_token=expired; invitta_refresh_token=test';
  const recovered = await call(refreshed);
  assert.equal(recovered.body.args.accessToken, 'valid'); assert(recovered.headers['Set-Cookie'].length === 2);
  const outage = await call(req(), { ...authService, getAuthenticatedUser: async () => { throw new Error('secret'); } });
  assert.equal(outage.statusCode, 502); assert(!JSON.stringify(outage.body).includes('secret'));
  const malformed = req('POST'); malformed.body = '{bad'; assert.equal((await call(malformed)).statusCode, 422);
  malformed.body = 'x'.repeat(8193); assert.equal((await call(malformed)).statusCode, 422);
  for (const method of ['PUT', 'DELETE', 'OPTIONS']) assert.equal((await call(req(method))).statusCode, 405);
  const conflict = await call(req('PATCH'), authService, async () => { throw Object.assign(new Error('stale'), { status: 409, code: 'CONFLICT' }); });
  assert.equal(conflict.body.code, 'CONFLICT'); assert.equal(conflict.statusCode, 409);
  assert.equal(conflict.headers['Cache-Control'], 'no-store');
  assert.equal(conflict.headers['X-Content-Type-Options'], 'nosniff');
  console.log('Project operation handler methods, cookies, origin and failure boundaries passed.');
})().catch(e => { console.error(e); process.exitCode = 1; });
