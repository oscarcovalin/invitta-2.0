const assert = require('node:assert/strict');

async function main() {
  const { default: middleware } = await import('./middleware.js');
  const previousFetch = global.fetch;
  const previousUrl = process.env.SUPABASE_URL;
  const previousKey = process.env.SUPABASE_PUBLISHABLE_KEY;

  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_PUBLISHABLE_KEY = 'test-publishable-key';

  try {
    const calls = [];
    global.fetch = async (url, options) => {
      calls.push({ url, options });
      return { ok: true, json: async () => ({ id: 'user-123', email: 'owner@example.com' }) };
    };

    const studio = new Request('https://invitta.example/invitacion-estudio.html?project=project-123', {
      headers: { cookie: 'invitta_access_token=valid-professional-token' },
    });
    assert.equal(await middleware(studio), undefined, 'verified professional session opens Studio');
    assert.equal(calls.length, 1);
    assert.equal(String(calls[0].url), 'https://example.supabase.co/auth/v1/user');
    assert.equal(calls[0].options.headers.apikey, 'test-publishable-key');
    assert.equal(calls[0].options.headers.Authorization, 'Bearer valid-professional-token');

    const otherModule = new Request('https://invitta.example/organizador-mesas.html', {
      headers: { cookie: 'invitta_access_token=valid-professional-token' },
    });
    assert.equal((await middleware(otherModule)).status, 302, 'professional cookie does not unlock legacy modules');
    assert.equal(calls.length, 1);

    for (const cookie of [
      'invitta_access_token=expired; invitta_refresh_token=valid-refresh',
      'invitta_refresh_token=valid-refresh',
    ]) {
      const refreshCalls = [];
      global.fetch = async (url, options) => {
        refreshCalls.push(String(url));
        if (String(url).endsWith('/auth/v1/user')) return { ok: false, status: 401, json: async () => ({}) };
        assert.equal(String(url), 'https://example.supabase.co/auth/v1/token?grant_type=refresh_token');
        assert.deepEqual(JSON.parse(options.body), { refresh_token: 'valid-refresh' });
        return { ok: true, status: 200, json: async () => ({
          access_token: 'renewed-access', refresh_token: 'renewed-refresh', expires_in: 3600,
          user: { id: 'user-123', email: 'owner@example.com' },
        }) };
      };
      const expired = new Request(studio.url, { headers: { cookie } });
      const renewed = await middleware(expired);
      assert.equal(renewed.status, 307, 'a renewable session must return to the same Studio URL');
      assert.equal(renewed.headers.get('location'), studio.url, 'renewal preserves the selected project');
      assert.match(renewed.headers.get('set-cookie'), /invitta_access_token=renewed-access/);
      assert.match(renewed.headers.get('set-cookie'), /invitta_refresh_token=renewed-refresh/);
      assert.match(renewed.headers.get('set-cookie'), /HttpOnly/);
      assert.match(renewed.headers.get('set-cookie'), /Secure/);
      assert.equal(renewed.headers.get('cache-control'), 'private, no-store');
      assert.equal(refreshCalls.filter((url) => url.includes('grant_type=refresh_token')).length, 1);
    }

    global.fetch = async () => ({ ok: false, status: 400, json: async () => ({}) });
    const revoked = await middleware(new Request(studio.url, {
      headers: { cookie: 'invitta_refresh_token=revoked-refresh' },
    }));
    assert.equal(revoked.status, 302);
    assert.match(revoked.headers.get('set-cookie'), /invitta_access_token=;.*Max-Age=0/);
    assert.match(revoked.headers.get('set-cookie'), /invitta_refresh_token=;.*Max-Age=0/);

    global.fetch = async () => ({ ok: false, status: 401, json: async () => ({}) });
    assert.equal((await middleware(studio)).status, 302, 'rejected token cannot open Studio');
    const login = new URL((await middleware(studio)).headers.get('location'));
    assert.equal(login.searchParams.get('next'), '/invitacion-estudio.html?project=project-123');

    global.fetch = async () => ({ ok: true, json: async () => ({ id: 'anonymous-user', is_anonymous: true }) });
    assert.equal((await middleware(studio)).status, 302, 'anonymous auth does not open professional Studio');

    global.fetch = async () => { throw new Error('Auth service unavailable'); };
    const outage = await middleware(studio);
    assert.equal(outage.status, 503, 'Auth outage fails closed without pretending the session expired');
    assert.equal(outage.headers.get('set-cookie'), null);

    delete process.env.SUPABASE_PUBLISHABLE_KEY;
    assert.equal((await middleware(studio)).status, 503, 'missing Auth configuration fails closed');
    process.env.SUPABASE_PUBLISHABLE_KEY = 'test-publishable-key';

    const noCookie = new Request('https://invitta.example/invitacion-estudio.html');
    assert.equal((await middleware(noCookie)).status, 302, 'missing cookie cannot open Studio');
  } finally {
    global.fetch = previousFetch;
    if (previousUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.SUPABASE_PUBLISHABLE_KEY;
    else process.env.SUPABASE_PUBLISHABLE_KEY = previousKey;
  }
}

main().then(() => console.log('Studio middleware accepts only verified professional sessions.'))
  .catch((error) => { console.error(error); process.exitCode = 1; });
