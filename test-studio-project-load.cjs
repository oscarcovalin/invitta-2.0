const assert = require('node:assert');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('./app.js', 'utf8');
const initialization = source.slice(0, source.indexOf('// ==================== INICIALIZACIÓN'));
const projectId = '20000000-0000-4000-8000-000000000002';
const context = {
  window: { location: { search: `?project=${projectId}` } },
  URLSearchParams,
  JSON,
  TemplateEngine: {
    defaultConfig: { name: 'Predeterminado' },
    defaultThemes: { vino: {} },
  },
  ProjectsVault: {
    getById: () => ({ id: projectId, title: 'Prueba', config: { name: 'Proyecto guardado' }, theme: 'rosa' }),
  },
  document: { addEventListener: () => {} },
  console: { log: () => {} },
};

vm.createContext(context);
assert.doesNotThrow(() => vm.runInContext(initialization, context));
assert.strictEqual(vm.runInContext('currentProjectId', context), projectId);
assert.strictEqual(vm.runInContext('currentConfig.name', context), 'Proyecto guardado');
assert.strictEqual(vm.runInContext('currentThemeName', context), 'rosa');

console.log('Studio loads a selected project before rendering the editor.');
