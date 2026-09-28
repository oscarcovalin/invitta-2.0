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

    global.fetch = async () => ({ ok: false, json: async () => ({}) });
    assert.equal((await middleware(studio)).status, 302, 'rejected token cannot open Studio');

    global.fetch = async () => ({ ok: true, json: async () => ({ id: 'anonymous-user', is_anonymous: true }) });
    assert.equal((await middleware(studio)).status, 302, 'anonymous auth does not open professional Studio');

    global.fetch = async () => { throw new Error('Auth service unavailable'); };
    assert.equal((await middleware(studio)).status, 302, 'Auth outage fails closed');

    delete process.env.SUPABASE_PUBLISHABLE_KEY;
    assert.equal((await middleware(studio)).status, 302, 'missing Auth configuration fails closed');
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
