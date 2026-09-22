const assert = require('node:assert');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('./app.js', 'utf8');
const initialization = source.slice(0, source.indexOf('// ==================== INICIALIZACIÓN'));
const projectId = '20000000-0000-4000-8000-000000000002';
const status = { textContent: '' };
const context = {
  window: {
    location: { search: `?project=${projectId}` },
    InvitationDocumentAdapter: require('./invitation-document-adapter.js'),
  },
  URLSearchParams,
  JSON,
  TemplateEngine: {
    defaultConfig: { name: 'Predeterminado' },
    defaultThemes: { vino: {} },
  },
  ProjectsVault: {
    getById: () => ({ id: projectId, title: 'Prueba', config: { name: 'Proyecto guardado' }, theme: 'rosa' }),
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
};

vm.createContext(context);
assert.doesNotThrow(() => vm.runInContext(initialization, context));
assert.strictEqual(vm.runInContext('currentProjectId', context), projectId);
assert.strictEqual(vm.runInContext('currentConfig.name', context), 'Proyecto guardado');
assert.strictEqual(vm.runInContext('currentThemeName', context), 'rosa');

(async () => {
  await vm.runInContext('loadCloudProject()', context);
  assert.strictEqual(vm.runInContext('currentConfig.name', context), 'Proyecto en nube');
  assert.strictEqual(vm.runInContext('currentConfig.typography.names', context), 'Lora');
  assert.strictEqual(vm.runInContext('loadedCloudRevision', context), 5);
  assert.match(status.textContent, /Revisión 5 cargada/);
  console.log('Studio loads a selected project and its latest visible cloud revision.');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
