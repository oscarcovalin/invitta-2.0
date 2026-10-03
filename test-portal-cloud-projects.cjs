const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const storage = new Map();
const context = {
  URLSearchParams,
  window: {},
  sessionStorage: {
    setItem: (key, value) => storage.set(key, value),
    getItem: (key) => storage.get(key) || null,
    removeItem: (key) => storage.delete(key),
  },
};
vm.createContext(context);
vm.runInContext(fs.readFileSync('./src/portal-cloud-projects.js', 'utf8'), context);

(async () => {
  const projectId = '20000000-0000-4000-8000-000000000004';
  let request;
  context.fetch = async (url, options) => {
    request = { url, options };
    return { ok: true, status: 201, json: async () => ({ success: true, project: { id: projectId, name: 'Mis XV Janna' } }) };
  };
  const created = await context.window.InvittaProjectPortal.createProject({
    name: ' Mis XV Janna ', eventType: 'quinceanera', honoree: 'Janna Sharlot',
    startsAt: '2026-11-13T19:30:00-06:00', venue: 'Salón Plaza Hidalgo', packageType: 'host_premium',
  });
  assert.equal(created.project.id, projectId);
  assert.equal(created.initialDraftStored, true);
  assert.equal(request.url, '/api/projects/create');
  assert.equal(request.options.credentials, 'same-origin');
  assert.deepEqual(JSON.parse(request.options.body), { name: 'Mis XV Janna', eventType: 'quinceanera' });
  const studioConfig = { reception: { address: 'Dirección por definir' }, typography: { customNamesFile: 'data:application/octet-stream;base64,AA==', customNamesFileName: 'default.ttf' } };
  assert.equal(context.window.InvittaProjectPortal.applyInitialDraft(studioConfig, projectId), true);
  assert.equal(studioConfig.eventType, 'xv');
  assert.equal(studioConfig.name, 'Mis XV Janna');
  assert.equal(studioConfig.brideName, 'Janna Sharlot');
  assert.equal(studioConfig.groomName, '');
  assert.equal(studioConfig.eventDateISO, '2026-11-13T19:30:00-06:00');
  assert.equal(studioConfig.timezoneOffset, '-06:00');
  assert.match(studioConfig.eventDateLabel, /13 de noviembre de 2026/i);
  assert.match(studioConfig.reception.time, /07:30/);
  assert.equal(studioConfig.reception.venue, 'Salón Plaza Hidalgo');
  assert.equal(studioConfig.packageType, 'host_premium');
  assert.equal(studioConfig.typography.customNamesFile, '');
  assert.equal(context.window.InvittaProjectPortal.takeInitialDraft(projectId), null);

  context.fetch = async () => ({ ok: true, status: 200, json: async () => ({ success: true, projects: [{ id: projectId }] }) });
  assert.equal((await context.window.InvittaProjectPortal.listProjects())[0].id, projectId);
  context.fetch = async () => ({ ok: false, status: 401, json: async () => ({ success: false, error: 'Sesión no válida.' }) });
  await assert.rejects(context.window.InvittaProjectPortal.listProjects(), /Sesión no válida/);
  console.log('Portal uses cloud projects, keeps initial details tab-local, and propagates auth errors.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
