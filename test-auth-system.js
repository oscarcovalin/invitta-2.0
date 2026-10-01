const assert = require('assert');
const fs = require('fs');
const { AuthManager } = require('./auth-manager.js');

console.log('\nTesting server-backed authentication and session handling...\n');

const tests = [];
function test(description, fn) {
  tests.push({ description, fn });
}

function response(ok, data) {
  return { ok, json: async () => data };
}

test('professional login sends credentials to the auth API and keeps only its public session in memory', async () => {
  let request;
  global.fetch = async (url, options) => {
    request = { url, options };
    return response(true, {
      success: true,
      session: { role: 'platform_admin', email: 'admin@invitta.mx' },
      redirectUrl: 'portal.html'
    });
  };

  const auth = new AuthManager();
  const result = await auth.loginProfessional('admin@invitta.mx', 'secret');
  assert.strictEqual(result.success, true);
  assert.strictEqual(request.url, '/api/auth');
  assert.deepStrictEqual(JSON.parse(request.options.body), {
    username: 'admin@invitta.mx',
    password: 'secret'
  });
  assert.strictEqual(auth.isSuperadmin(), true);
  assert.strictEqual(auth.getCurrentSession().token, undefined);
});

test('professional login rejects incomplete credentials without calling the API', async () => {
  let calls = 0;
  global.fetch = async () => { calls += 1; };
  const result = await new AuthManager().loginProfessional('', 'secret');
  assert.strictEqual(result.success, false);
  assert.strictEqual(calls, 0);
});

test('professional login exposes the server error without creating a session', async () => {
  global.fetch = async () => response(false, { error: 'Credenciales inválidas' });
  const auth = new AuthManager();
  const result = await auth.loginProfessional('admin', 'wrong');
  assert.deepStrictEqual(result, { success: false, error: 'Credenciales inválidas' });
  assert.strictEqual(auth.getCurrentSession(), null);
});

test('professional login returns a controlled connection error', async () => {
  global.fetch = async () => { throw new Error('offline'); };
  const result = await new AuthManager().loginProfessional('admin', 'secret');
  assert.strictEqual(result.success, false);
  assert.match(result.error, /conexión/i);
});

test('host login sends normalized event code and PIN to the login API', async () => {
  let request;
  global.fetch = async (url, options) => {
    request = { url, options };
    return response(true, { success: true });
  };

  const result = await new AuthManager().loginHostByPin('  CATALINA-JULIAN  ', ' 4821 ');
  assert.strictEqual(result.success, true);
  assert.strictEqual(result.eventCode, 'CATALINA-JULIAN');
  assert.strictEqual(request.url, '/api/login');
  assert.deepStrictEqual(JSON.parse(request.options.body), {
    eventCode: 'CATALINA-JULIAN',
    pin: '4821'
  });
});

test('host login rejects missing values before contacting the API', async () => {
  let calls = 0;
  global.fetch = async () => { calls += 1; };
  const auth = new AuthManager();
  assert.strictEqual((await auth.loginHostByPin('', '4821')).success, false);
  assert.strictEqual((await auth.loginHostByPin('EVENTO', '')).success, false);
  assert.strictEqual(calls, 0);
});

test('host login preserves a server validation error', async () => {
  global.fetch = async () => response(false, { error: 'Código o PIN incorrecto' });
  const result = await new AuthManager().loginHostByPin('EVENTO', '0000');
  assert.deepStrictEqual(result, { success: false, error: 'Código o PIN incorrecto' });
});

test('logout clears the in-memory session', async () => {
  let request;
  global.fetch = async (url, options) => {
    request = { url, options };
    return response(true, {});
  };
  const auth = new AuthManager();
  auth.saveSession({ role: 'platform_admin' });
  await auth.logout();
  assert.strictEqual(request.url, '/api/logout');
  assert.strictEqual(request.options.method, 'POST');
  assert.strictEqual(auth.isSuperadmin(), false);
  assert.strictEqual(auth.getCurrentSession(), null);
});

test('portal restores the server session before deciding which interface to show', async () => {
  const portal = fs.readFileSync('./portal.html', 'utf8');
  assert.match(portal, /await auth\.refreshSession\(\)/);
  assert.match(portal, /res\.session\.role === 'platform_admin'/);
});

test('temporary session failures do not mean logout and cannot retain effective admin access', async () => {
  for (const status of [429, 500, 502, 503]) {
    const auth = new AuthManager();
    auth.saveSession({ role: 'platform_admin', email: 'admin@example.test' });
    global.fetch = async () => ({ status, ...response(false, { authenticated: false }) });
    assert.strictEqual(await auth.refreshSession(), null);
    assert.strictEqual(auth.getSessionStatus(), 'unavailable');
    assert.strictEqual(auth.isSuperadmin(), false);
    global.fetch = async () => ({ status: 200, ...response(true, {
      authenticated: true, session: { role: 'platform_admin', email: 'admin@example.test' },
    }) });
    await auth.refreshSession();
    assert.strictEqual(auth.getSessionStatus(), 'authenticated');
    assert.strictEqual(auth.isSuperadmin(), true);
  }
});

test('network and malformed session responses offer retry without claiming an anonymous session', async () => {
  for (const fetchImpl of [
    async () => { throw new Error('offline'); },
    async () => ({ status: 200, ok: true, json: async () => { throw new Error('invalid JSON'); } }),
    async () => ({ status: 200, ...response(true, {}) }),
    async () => ({ status: 200, ...response(true, { authenticated: true, session: {} }) }),
  ]) {
    global.fetch = fetchImpl;
    const auth = new AuthManager();
    await auth.refreshSession();
    assert.strictEqual(auth.getSessionStatus(), 'unavailable');
    assert.strictEqual(auth.getCurrentSession(), null);
  }
});

test('only an explicit absent or rejected session becomes anonymous', async () => {
  for (const [status, data] of [[401, {}], [403, {}], [200, { authenticated: false }]]) {
    global.fetch = async () => ({ status, ...response(status === 200, data) });
    const auth = new AuthManager();
    auth.saveSession({ role: 'platform_admin' });
    await auth.refreshSession();
    assert.strictEqual(auth.getSessionStatus(), 'anonymous');
    assert.strictEqual(auth.getCurrentSession(), null);
  }
});

test('session validation blocks access while pending, shares concurrent checks, and cannot undo logout', async () => {
  let resolveResponse;
  let calls = 0;
  global.fetch = () => { calls += 1; return new Promise((resolve) => { resolveResponse = resolve; }); };
  const auth = new AuthManager();
  auth.saveSession({ role: 'platform_admin' });
  const first = auth.refreshSession();
  const second = auth.refreshSession();
  assert.strictEqual(auth.getSessionStatus(), 'checking');
  assert.strictEqual(auth.isSuperadmin(), false);
  assert.strictEqual(calls, 1);
  global.fetch = async () => response(true, {});
  await auth.logout();
  resolveResponse({ status: 200, ...response(true, {
    authenticated: true, session: { role: 'platform_admin', email: 'admin@example.test' },
  }) });
  await Promise.all([first, second]);
  assert.strictEqual(auth.getSessionStatus(), 'anonymous');
  assert.strictEqual(auth.getCurrentSession(), null);
});

test('session requests bypass caches and use only same-origin cookies', async () => {
  let options;
  global.fetch = async (_, input) => { options = input; return { status: 401, ...response(false, {}) }; };
  await new AuthManager().refreshSession();
  assert.strictEqual(options.cache, 'no-store');
  assert.strictEqual(options.credentials, 'same-origin');
});

test('a pending login cannot recreate an admin session after logout', async () => {
  let resolveLogin;
  let signal;
  global.fetch = async (url, options) => {
    if (url === '/api/logout') return response(true, {});
    signal = options.signal;
    return new Promise((resolve) => { resolveLogin = resolve; });
  };
  const auth = new AuthManager();
  const login = auth.loginProfessional('admin@example.test', 'test-only');
  await auth.logout();
  resolveLogin(response(true, { success: true, session: { role: 'platform_admin', email: 'admin@example.test' } }));
  const result = await login;
  assert.strictEqual(result.success, false);
  assert.strictEqual(auth.getSessionStatus(), 'anonymous');
  assert.strictEqual(auth.isSuperadmin(), false);
  assert.strictEqual(signal.aborted, true);
});

(async () => {
  let passed = 0;
  for (const { description, fn } of tests) {
    try {
      await fn();
      console.log(`  PASS: ${description}`);
      passed += 1;
    } catch (error) {
      console.error(`  FAIL: ${description}`, error.message);
    }
  }

  console.log(`\nResults: ${passed} / ${tests.length} passed.\n`);
  if (passed < tests.length) process.exitCode = 1;
})();
