const assert = require('node:assert/strict');
const auth = require('./lib/supabase-auth-service.cjs');
const { createSessionHandler } = require('./lib/request-auth-session.cjs');
const config = { url: 'https://auth.example.test', publishableKey: 'test-publishable' };
const user = { id: 'verified-owner', email: 'owner@example.test', app_metadata: { platform_role: 'platform_admin' } };

async function run({ cookie, status = 200, payload = user, networkFailure = false, authConfig = config }) {
  let calls = 0;
  const fetchImpl = async (url) => {
    calls++;
    if (networkFailure) throw new Error('network failure with private upstream detail');
    const isRefresh = url.includes('grant_type=refresh_token');
    return { ok: status === 200, status, json: async () => isRefresh && payload === user ? {
      access_token: 'new-access', refresh_token: 'new-refresh', expires_in: 3600, user,
    } : payload };
  };
  const handler = createSessionHandler({ authService: {
    ...auth, getAuthConfig: () => authConfig,
    getAuthenticatedUser: (args) => auth.getAuthenticatedUser({ ...args, fetchImpl }),
    refreshAuthSession: (args) => auth.refreshAuthSession({ ...args, fetchImpl }),
  } });
  const response = { headers: {}, setHeader(key, value) { this.headers[key] = value; },
    status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
  await handler({ method: 'GET', headers: { cookie, 'x-forwarded-proto': 'https' } }, response);
  return { ...response, calls };
}

(async () => {
  for (const cookie of ['invitta_access_token=valid-access', 'invitta_refresh_token=valid-refresh']) {
    const valid = await run({ cookie });
    assert.equal(valid.code, 200);
    assert.deepEqual(valid.body, { authenticated: true, session: {
      userId: user.id, email: user.email, role: 'platform_admin',
    } });
    assert.ok(!JSON.stringify(valid.body).includes('new-access'));
    assert.equal(valid.headers['Cache-Control'], 'no-store');
  }
  for (const cookie of ['invitta_access_token=valid-access', 'invitta_refresh_token=valid-refresh']) {
    for (const options of [{ status: 503 }, { status: 429 }, { payload: {} }, { networkFailure: true }]) {
      const unavailable = await run({ cookie, ...options });
      assert.equal(unavailable.code, 502);
      assert.equal(unavailable.headers['Set-Cookie'], undefined);
      assert.equal(unavailable.calls, 1);
      assert.deepEqual(unavailable.body, { authenticated: false });
    }
    const notConfigured = await run({ cookie, authConfig: {} });
    assert.equal(notConfigured.code, 503);
    assert.equal(notConfigured.calls, 0);
    assert.equal(notConfigured.headers['Set-Cookie'], undefined);
  }
  const revoked = await run({ cookie: 'invitta_refresh_token=revoked', status: 400 });
  assert.equal(revoked.code, 401);
  assert.ok(revoked.headers['Set-Cookie'].every((value) => value.includes('Max-Age=0')));
  const absent = await run({});
  assert.equal(absent.code, 401);
  assert.equal(absent.calls, 0);
  console.log('Session endpoint distinguishes expired sessions from transient upstream failures.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
