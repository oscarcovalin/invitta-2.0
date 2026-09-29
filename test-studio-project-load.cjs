const assert = require('node:assert');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('./app.js', 'utf8');
const initialization = source.slice(0, source.indexOf('// ==================== INICIALIZACIÓN'));
const projectId = '20000000-0000-4000-8000-000000000002';
const status = { textContent: '' };
let vaultLookups = 0;
const context = {
  window: {
    location: { search: `?project=${projectId}` },
  },
  URLSearchParams,
  JSON,
  TemplateEngine: {
    defaultConfig: { name: 'Predeterminado' },
    defaultThemes: { vino: {} },
  },
  ProjectsVault: {
    getById: () => {
      vaultLookups += 1;
      return ({ id: projectId, title: 'Prueba', config: { name: 'Proyecto guardado' }, theme: 'rosa' });
    },
  },
  document: { addEventListener: () => {}, getElementById: () => status },
  fetch: async () => ({
    ok: true,
    json: async () => ({
      revision: {
        revision: 5,
        document: {
          projectId, revision: 5,
          event: { type: 'wedding', startsAt: '2027-01-01T18:00:00-06:00', durationMinutes: 360 },
          content: { title: 'Proyecto en nube' }, design: { theme: 'rosa' },
          sections: [], assets: {}, legacy: { config: { typography: { names: 'Lora' } } },
        },
      },
    }),
  }),
  console: { log: () => {} },
  showToast: (message) => { throw new Error(message); },
};

vm.createContext(context);
vm.runInContext(fs.readFileSync('./invitation-document-adapter.js', 'utf8'), context);
vm.runInContext(fs.readFileSync('./project-asset-client.js', 'utf8'), context);
assert.doesNotThrow(() => vm.runInContext(initialization, context));
assert.strictEqual(vm.runInContext('currentProjectId', context), projectId);
assert.strictEqual(vm.runInContext('currentConfig.name', context), 'Predeterminado');
assert.strictEqual(vaultLookups, 0, 'cloud UUIDs must not initialize the local demo vault');

(async () => {
  await vm.runInContext('loadCloudProject()', context);
  assert.strictEqual(vm.runInContext('currentConfig.name', context), 'Proyecto en nube');
  assert.strictEqual(vm.runInContext('currentConfig.typography.names', context), 'Lora');
  assert.strictEqual(vm.runInContext('loadedCloudRevision', context), 5);
  assert.match(status.textContent, /Revisión 5 cargada/);

  const visited = [];
  context.fetch = async (url) => {
    visited.push(url);
    if (url.includes('latest-revision')) return { ok: false, status: 404, json: async () => ({ success: false }) };
    return { ok: true, status: 200, json: async () => ({ project: { id: projectId, status: 'draft' } }) };
  };
  vm.runInContext("currentConfig = { name: 'Proyecto nuevo' }; loadedCloudRevision = null; cloudLoadError = false;", context);
  await vm.runInContext('loadCloudProject()', context);
  assert.strictEqual(vm.runInContext('currentConfig.name', context), 'Proyecto nuevo');
  assert.strictEqual(vm.runInContext('cloudLoadError', context), false);
  assert.match(status.textContent, /sin revisiones/);
  assert.ok(visited.some((url) => url.includes('/api/projects/get?projectId=')));

  const legacyContext = {
    window: { location: { search: '?project=legacy-project-7' } },
    URLSearchParams,
    JSON,
    TemplateEngine: { defaultConfig: { name: 'Predeterminado' }, defaultThemes: { vino: {} } },
    ProjectsVault: {
      getById: (id) => id === 'legacy-project-7'
        ? { id, title: 'Proyecto anterior', config: { name: 'Borrador local' }, theme: 'rosa' }
        : null,
    },
    document: { addEventListener: () => {}, getElementById: () => ({ textContent: '' }) },
    console: { log: () => {} },
  };
  vm.createContext(legacyContext);
  vm.runInContext(initialization, legacyContext);
  assert.strictEqual(vm.runInContext('currentConfig.name', legacyContext), 'Borrador local');
  assert.strictEqual(vm.runInContext('currentProjectId', legacyContext), 'legacy-project-7');
  console.log('Studio loads a selected project and its latest visible cloud revision.');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
