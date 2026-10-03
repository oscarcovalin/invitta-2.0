const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync('./invitacion-estudio.html', 'utf8');
const start = html.indexOf('    window.closeHostProtectedModal = function()');
const end = html.indexOf('  </script>', start);
assert.ok(start >= 0 && end > start, 'Studio session guard exists');
const script = html.slice(start, end);

async function runGuard({ search, sessionResponse }) {
  const modal = { style: { display: 'none' } };
  const toasts = [];
  const requests = [];
  const context = {
    window: { location: { search } },
    document: { getElementById: (id) => id === 'hostProtectedDesignModal' ? modal : null },
    fetch: async (url, options) => {
      requests.push({ url, options });
      if (sessionResponse instanceof Error) throw sessionResponse;
      return { ok: sessionResponse.ok, json: async () => sessionResponse.body };
    },
    showToast: (message) => toasts.push(message),
    localStorage: { setItem() { throw new Error('URL must not set a role'); } },
  };
  vm.runInNewContext(script, context);
  await new Promise(setImmediate);
  return { modal, requests, toasts, window: context.window };
}

(async () => {
  for (const search of ['?role=designer', '?role=planner', '?edit=true', '?unlock=true']) {
    const denied = await runGuard({ search, sessionResponse: { ok: false, body: { authenticated: false } } });
    assert.equal(denied.modal.style.display, 'flex', `${search} must not dismiss the session notice`);
    assert.equal(denied.requests[0].url, '/api/session');
    await denied.window.unlockDesignerMode();
    assert.equal(denied.modal.style.display, 'flex');
    assert.match(denied.toasts.at(-1), /Inicia sesión/);
  }

  const offline = await runGuard({ search: '?role=designer', sessionResponse: new Error('network unavailable') });
  assert.equal(offline.modal.style.display, 'flex');

  const authorized = await runGuard({ search: '?role=designer', sessionResponse: {
    ok: true, body: { authenticated: true, session: { role: 'member' } },
  } });
  assert.equal(authorized.modal.style.display, 'none');
  assert.equal(authorized.requests[0].options.credentials, 'same-origin');

  const malformed = await runGuard({ search: '?unlock=true', sessionResponse: {
    ok: true, body: { authenticated: 'yes' },
  } });
  assert.equal(malformed.modal.style.display, 'flex');

  console.log('Studio URL flags do not authorize cloud editing; session checks fail closed.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
