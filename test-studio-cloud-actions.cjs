const assert = require('node:assert');
const fs = require('node:fs');
const vm = require('node:vm');

const projectId = '20000000-0000-4000-8000-000000000001';
const documentId = '30000000-0000-4000-8000-000000000001';
const storagePath = `${projectId}/hero/${documentId}.png`;
const buttons = Object.fromEntries(['btnSaveCloud', 'btnPublishCloud', 'btnCreateCloud'].map((id) => [id, {
  hidden: true, disabled: false, handlers: {},
  addEventListener(name, callback) { this.handlers[name] = callback; },
}]));
const requests = [];
const context = {
  window: { history: { replaceState(_state, _title, url) { this.lastUrl = url; } } }, URLSearchParams, encodeURIComponent, JSON,
  document: { getElementById: (id) => buttons[id] },
  fetch: async (url, options) => {
    requests.push({ url, body: JSON.parse(options.body) });
    if (url.endsWith('/upload-asset')) return { ok: true, json: async () => ({ asset: { storagePath } }) };
    if (url.endsWith('/save-revision')) return { ok: true, json: async () => ({ revision: { id: documentId, revision: 1 } }) };
    if (url.endsWith('/publish-revision')) return { ok: true, json: async () => ({ project: { status: 'published' } }) };
    if (url.endsWith('/create')) return { ok: true, json: async () => ({ project: { id: projectId, status: 'draft' } }) };
    throw new Error(`Unexpected request: ${url}`);
  },
  populateForm() {}, updatePreview() {}, showToast() {},
};
vm.createContext(context);
vm.runInContext(fs.readFileSync('./invitation-document-adapter.js', 'utf8'), context);
vm.runInContext(fs.readFileSync('./project-asset-client.js', 'utf8'), context);
const app = fs.readFileSync('./app.js', 'utf8');
const cloudActions = app.slice(app.indexOf('function setupCloudActions()'), app.indexOf('// ==================== HEADER ACTIONS & EXPORT'));
vm.runInContext(`
let requestedCloudProjectId = '${projectId}';
let currentConfig = { eventType: 'boda', name: 'Prueba', photos: { hero: 'data:image/png;base64,iVBORw0KGgo=' } };
let loadedCloudRevision = null;
let cloudLoadError = false;
let savedCloudDocumentId = null;
let cloudDirty = true;
let savedCloudConfig = null;
${cloudActions}
setupCloudActions();
`, context);

(async () => {
  assert.strictEqual(buttons.btnSaveCloud.hidden, false);
  await buttons.btnSaveCloud.handlers.click();
  assert.deepStrictEqual(requests.map((item) => item.url), ['/api/projects/upload-asset', '/api/projects/save-revision']);
  assert.strictEqual(requests[1].body.document.legacy.config.photos.hero, storagePath);
  assert.strictEqual(requests[1].body.expectedRevision, 0);
  assert.strictEqual(vm.runInContext('cloudDirty', context), false);
  assert.match(vm.runInContext('currentConfig.photos.hero', context), /^\/api\/projects\/asset\?path=/);
  await buttons.btnPublishCloud.handlers.click();
  assert.strictEqual(requests[2].url, '/api/projects/publish-revision');
  assert.strictEqual(requests[2].body.documentId, documentId);

  vm.runInContext("requestedCloudProjectId = null; currentProjectId = null; currentConfig.name = 'Nueva boda';", context);
  vm.runInContext('setupProjectCreationAction()', context);
  await buttons.btnCreateCloud.handlers.click();
  assert.strictEqual(requests[3].url, '/api/projects/create');
  assert.strictEqual(requests[3].body.name, 'Nueva boda');
  assert.strictEqual(vm.runInContext('requestedCloudProjectId', context), projectId);
  assert.match(context.window.history.lastUrl, /project=20000000/);
  console.log('Studio uploads private images, saves a revision, and publishes only the saved document.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
