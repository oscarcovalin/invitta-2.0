const assert = require('node:assert');

const {
  authenticateWithPassword,
  confirmPasswordRecovery,
  inviteProfessionalUser,
  isPlatformAdmin,
  requestPasswordRecovery,
  registerProfessionalAccount,
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
  secretKey: 'sb_secret_server_only_test',
  authRedirectUrl: 'https://preview.example.test/portal.html',
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
  assert.equal(isPlatformAdmin({ email: 'opl2@yahoo.com' }, { INVITTA_BOOTSTRAP_ADMIN_EMAIL: 'opl2@yahoo.com' }), false);
  assert.equal(isPlatformAdmin({ email: 'other@example.com', user_metadata: { platform_role: 'platform_admin' } }, {}), false);
  assert.equal(isPlatformAdmin({ email: 'other@example.com', app_metadata: { platform_role: 'platform_admin' } }, {}), true);

  let inviteRequest;
  const invited = await inviteProfessionalUser({
    email: ' Planner@Example.com ', config, accessToken: 'verified-admin-token',
    fetchImpl: async (url, options) => {
      inviteRequest = { url, options };
      return { ok: true, json: async () => ({ id: 'new-user', email: 'planner@example.com' }) };
    },
  });
  assert.equal(inviteRequest.url, `${config.url}/auth/v1/invite?redirect_to=${encodeURIComponent(config.authRedirectUrl)}`);
  assert.equal(inviteRequest.options.headers.Authorization, `Bearer ${config.secretKey}`);
  assert.equal(inviteRequest.options.headers.apikey, config.secretKey);
  assert.deepEqual(JSON.parse(inviteRequest.options.body), { email: 'planner@example.com', data: { platform_role: 'member' } });
  assert.deepEqual(invited, { id: 'new-user', email: 'planner@example.com' });

  let recoveryRequest;
  await confirmPasswordRecovery({
    accessToken: 'recovery-token', newPassword: 'New-password-123!', config,
    fetchImpl: async (url, options) => {
      recoveryRequest = { url, options };
      return { ok: true, json: async () => ({ id: 'new-user' }) };
    },
  });
  assert.equal(recoveryRequest.url, `${config.url}/auth/v1/user`);
  assert.equal(recoveryRequest.options.headers.Authorization, 'Bearer recovery-token');
  assert.deepEqual(JSON.parse(recoveryRequest.options.body), { password: 'New-password-123!' });

  await assert.rejects(inviteProfessionalUser({
    email: 'x@example.com', config,
    fetchImpl: async () => { throw new Error('should not call without admin token'); },
  }), (error) => error.code === 'UNAUTHENTICATED' && error.status === 401);
  await assert.rejects(inviteProfessionalUser({
    email: 'x@example.com', accessToken: 'verified-admin-token', config: { ...config, secretKey: '' },
    fetchImpl: async () => { throw new Error('must not invite without a server-only secret'); },
  }), (error) => error.code === 'AUTH_NOT_CONFIGURED' && error.status === 503);

  let forgotRequest;
  await requestPasswordRecovery({
    email: ' Admin@Example.com ', config,
    fetchImpl: async (url, options) => {
      forgotRequest = { url, options };
      return { ok: true };
    },
  });
  assert.equal(forgotRequest.url, `${config.url}/auth/v1/recover?redirect_to=${encodeURIComponent(config.authRedirectUrl)}`);
  assert.deepEqual(JSON.parse(forgotRequest.options.body), { email: 'admin@example.com' });
  await assert.rejects(requestPasswordRecovery({ email: 'not-an-email', config, fetchImpl: async () => { throw new Error('invalid email must fail before network'); } }), (error) => error.code === 'INVALID_EMAIL');

  let signupRequest;
  const signup = await registerProfessionalAccount({
    email: ' New.User@Example.com ', password: 'Long-password-123!', config,
    fetchImpl: async (url, options) => {
      signupRequest = { url, options };
      return { ok: true, json: async () => ({ user: { id: 'new-member', email: 'new.user@example.com', user_metadata: { role: 'platform_admin' } } }) };
    },
  });
  assert.equal(signupRequest.url, `${config.url}/auth/v1/signup?redirect_to=${encodeURIComponent(config.authRedirectUrl)}`);
  assert.deepEqual(JSON.parse(signupRequest.options.body), { email: 'new.user@example.com', password: 'Long-password-123!' });
  assert.equal(signup.session, null);
  assert.equal(toPublicSession(signup.user).role, 'member');
  await assert.rejects(registerProfessionalAccount({ email: 'new@example.com', password: 'short', config, fetchImpl: async () => { throw new Error('short password must fail before network'); } }), (error) => error.code === 'INVALID_PASSWORD');

  await assert.rejects(confirmPasswordRecovery({
    accessToken: 'recovery-token', newPassword: 'short', config,
    fetchImpl: async () => { throw new Error('should not call with short password'); },
  }), (error) => error.code === 'INVALID_PASSWORD' && error.status === 400);

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
      assert.equal(options.cache, 'no-store');
      assert.equal(options.redirect, 'error');
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
      assert.equal(options.cache, 'no-store');
      assert.equal(options.redirect, 'error');
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
