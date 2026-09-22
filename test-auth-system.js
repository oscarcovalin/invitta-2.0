const assert = require('assert');
const { AuthManager } = require('./auth-manager.js');

console.log('\nTesting server-backed authentication and session handling...\n');

const tests = [];
function test(description, fn) {
  tests.push({ description, fn });
}

function response(ok, data) {
  return { ok, json: async () => data };
}

test('professional login sends credentials to the auth API and saves its session', async () => {
  let request;
  global.fetch = async (url, options) => {
    request = { url, options };
    return response(true, {
      success: true,
      session: { role: 'superadmin', token: 'server-issued-token' },
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
  global.fetch = async () => response(true, {});
  const auth = new AuthManager();
  auth.saveSession({ role: 'superadmin', token: 'server-issued-token' });
  await auth.logout();
  assert.strictEqual(auth.isSuperadmin(), false);
  assert.strictEqual(auth.getCurrentSession(), null);
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
