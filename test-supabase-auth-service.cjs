const assert = require('node:assert');

const {
  authenticateWithPassword,
  getAuthenticatedUser,
  refreshAuthSession,
  revokeAuthSession,
  buildSessionCookies,
  clearSessionCookies,
  toPublicSession,
} = require('./lib/supabase-auth-service.cjs');

const config = {
  url: 'https://example.supabase.co',
  publishableKey: 'sb_publishable_test',
};

(async () => {
  let request;
  const fetchImpl = async (url, options) => {
    request = { url, options };
    return {
      ok: true,
      json: async () => ({
        access_token: 'access-secret',
        refresh_token: 'refresh-secret',
        expires_in: 3600,
        user: {
          id: '00000000-0000-4000-8000-000000000001',
          email: 'admin@invitta.mx',
          app_metadata: { platform_role: 'platform_admin' },
          user_metadata: { platform_role: 'platform_admin', role: 'superadmin' },
        },
      }),
    };
  };

  const result = await authenticateWithPassword({
    email: ' admin@invitta.mx ',
    password: ' secret ',
    config,
    fetchImpl,
  });

  assert.strictEqual(request.url, 'https://example.supabase.co/auth/v1/token?grant_type=password');
  assert.strictEqual(request.options.headers.apikey, config.publishableKey);
  assert.deepStrictEqual(JSON.parse(request.options.body), {
    email: 'admin@invitta.mx',
    password: ' secret ',
  });
  assert.strictEqual(result.accessToken, 'access-secret');
  assert.strictEqual(result.refreshToken, 'refresh-secret');

  const publicSession = toPublicSession(result.user);
  assert.deepStrictEqual(publicSession, {
    userId: '00000000-0000-4000-8000-000000000001',
    email: 'admin@invitta.mx',
    role: 'platform_admin',
  });
  assert.ok(!JSON.stringify(publicSession).includes('secret'));

  const cookies = buildSessionCookies(result, { secure: true });
  assert.strictEqual(cookies.length, 2);
  assert.ok(cookies.every((cookie) => cookie.includes('HttpOnly')));
  assert.ok(cookies.every((cookie) => cookie.includes('Secure')));
  assert.ok(cookies.every((cookie) => cookie.includes('SameSite=Lax')));
  assert.ok(cookies[0].includes('Max-Age=3600'));

  const verified = await getAuthenticatedUser({
    accessToken: 'access-secret',
    config,
    fetchImpl: async (url, options) => {
      assert.strictEqual(url, 'https://example.supabase.co/auth/v1/user');
      assert.strictEqual(options.headers.Authorization, 'Bearer access-secret');
      return { ok: true, json: async () => result.user };
    },
  });
  assert.strictEqual(verified.id, result.user.id);

  const refreshed = await refreshAuthSession({
    refreshToken: 'refresh-secret',
    config,
    fetchImpl: async (url, options) => {
      assert.strictEqual(url, 'https://example.supabase.co/auth/v1/token?grant_type=refresh_token');
      assert.deepStrictEqual(JSON.parse(options.body), { refresh_token: 'refresh-secret' });
      return {
        ok: true,
        json: async () => ({
          access_token: 'new-access', refresh_token: 'new-refresh', expires_in: 3600, user: result.user,
        }),
      };
    },
  });
  assert.strictEqual(refreshed.refreshToken, 'new-refresh');

  let revoked = false;
  await revokeAuthSession({
    accessToken: 'new-access',
    config,
    fetchImpl: async (url, options) => {
      revoked = true;
      assert.strictEqual(url, 'https://example.supabase.co/auth/v1/logout?scope=local');
      assert.strictEqual(options.headers.Authorization, 'Bearer new-access');
      return { ok: true };
    },
  });
  assert.strictEqual(revoked, true);

  const cleared = clearSessionCookies({ secure: true });
  assert.strictEqual(cleared.length, 2);
  assert.ok(cleared.every((cookie) => cookie.includes('Max-Age=0')));

  await assert.rejects(
    authenticateWithPassword({ email: 'a@b.com', password: 'x', config: {}, fetchImpl }),
    (error) => error.code === 'AUTH_NOT_CONFIGURED'
  );

  await assert.rejects(
    authenticateWithPassword({
      email: 'a@b.com',
      password: 'wrong',
      config,
      fetchImpl: async () => ({ ok: false, status: 400, json: async () => ({ message: 'sensitive detail' }) }),
    }),
    (error) => error.code === 'INVALID_CREDENTIALS' && !error.message.includes('sensitive detail')
  );

  console.log('Supabase auth service contract passed.');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
