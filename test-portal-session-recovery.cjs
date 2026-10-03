const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const portal = fs.readFileSync('./portal.html', 'utf8');
const elements = new Map();
function element(id) {
  if (!elements.has(id)) {
    const classes = new Set(['hidden']);
    elements.set(id, {
      classList: { add: (name) => classes.add(name), remove: (name) => classes.delete(name), contains: (name) => classes.has(name) },
      textContent: '', innerHTML: '', disabled: false,
      addEventListener: () => {}, querySelector: () => null,
    });
  }
  return elements.get(id);
}
let status = 'unavailable';
let listCalls = 0;
const context = {
  document: { getElementById: element, addEventListener: () => {} },
  window: {
    AuthManager: { create: () => ({
      getSessionStatus: () => status,
      isSuperadmin: () => status === 'authenticated',
      getCurrentSession: () => status === 'authenticated' ? { email: 'admin@example.test' } : null,
      refreshSession: async () => { status = 'authenticated'; },
    }) },
    InvittaProjectPortal: { listProjects: async () => { listCalls += 1; throw new Error('Temporal'); } },
  },
};
vm.createContext(context);
const inlineScript = [...portal.matchAll(/<script>([\s\S]*?)<\/script>/g)].at(-1)[1];
vm.runInContext(inlineScript, context);
const run = (code) => vm.runInContext(code, context);

(async () => {
  run('updateAuthGateUI()');
  assert.equal(element('publicAuthGate').classList.contains('hidden'), true, 'Outage must not show login as if the account expired');
  assert.equal(element('adminVaultDashboard').classList.contains('hidden'), true, 'Outage must not retain effective admin UI');
  assert.equal(element('portalSessionStatus').classList.contains('hidden'), false);
  assert.match(element('portalSessionMessage').textContent, /temporal|verificar/i);
  assert.equal(element('btnRetryPortalSession').disabled, false);
  status = 'checking';
  run('updateAuthGateUI()');
  assert.equal(element('btnRetryPortalSession').disabled, true);
  status = 'anonymous';
  run('updateAuthGateUI()');
  assert.equal(element('publicAuthGate').classList.contains('hidden'), false);
  assert.equal(element('portalSessionStatus').classList.contains('hidden'), true);
  status = 'unavailable';
  await run('restorePortalSession()');
  assert.equal(listCalls, 1);
  assert.equal(element('adminVaultDashboard').classList.contains('hidden'), false);
  assert.match(element('vaultProjectsGrid').innerHTML, /Temporal/);
  assert.match(element('vaultProjectsGrid').innerHTML, /btnRetryCloudProjects/);
  run("renderVaultProjects('Janna', 'xv')");
  assert.doesNotMatch(element('vaultProjectsGrid').innerHTML, /Aún no hay proyectos/);
  context.window.InvittaProjectPortal.listProjects = async () => [{
    id: '20000000-0000-4000-8000-000000000004', name: 'Prueba privada', event_type: 'quinceanera',
    status: 'draft', created_at: '2026-10-01T00:00:00Z',
  }];
  await run('refreshCloudProjects()');
  assert.match(element('vaultProjectsGrid').innerHTML, /Prueba privada/);
  assert.equal(element('countFilterAll').textContent, 1);
  let finishCheck;
  run('auth.refreshSession = () => new Promise((resolve) => { window.finishCheck = resolve; })');
  context.window.InvittaProjectPortal.listProjects = async () => { throw Object.assign(new Error('OLD401'), { status: 401 }); };
  const oldRequest = run('refreshCloudProjects()');
  await new Promise(setImmediate);
  finishCheck = context.window.finishCheck;
  context.window.InvittaProjectPortal.listProjects = async () => [{
    id: '20000000-0000-4000-8000-000000000004', name: 'Nueva lista verificada', event_type: 'quinceanera',
    status: 'draft', created_at: '2026-10-01T00:00:00Z',
  }];
  await run('refreshCloudProjects()');
  finishCheck();
  await oldRequest;
  assert.match(element('vaultProjectsGrid').innerHTML, /Nueva lista verificada/);
  assert.doesNotMatch(element('vaultProjectsGrid').innerHTML, /OLD401/);
  context.window.InvittaProjectPortal.listProjects = async () => [];
  await run('refreshCloudProjects()');
  assert.match(element('vaultProjectsGrid').innerHTML, /Aún no hay proyectos/);
  console.log('Portal distinguishes outages, rejected sessions and verified empty lists; retry restores projects.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
