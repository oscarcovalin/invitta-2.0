const assert = require('node:assert');
const fs = require('node:fs');
const vm = require('node:vm');

const projectId = '20000000-0000-4000-8000-000000000001';
const documentId = '30000000-0000-4000-8000-000000000001';
const storagePath = `${projectId}/hero/${documentId}.png`;
const buttons = Object.fromEntries(['btnSaveCloud', 'btnPreviewPublication', 'btnPublishCloud', 'btnCreateCloud'].map((id) => [id, {
  hidden: true, disabled: false, handlers: {},
  addEventListener(name, callback) { this.handlers[name] = callback; },
}]));
const previewDialog = { opened: false, showModal() { this.opened = true; }, close() { this.opened = false; } };
const previewSummary = { textContent: '' };
const previewJson = { textContent: '' };
const elements = { ...buttons, publicationPreviewDialog: previewDialog,
  publicationPreviewSummary: previewSummary, publicationPreviewJson: previewJson };
const requests = [];
const context = {
  window: { history: { replaceState(_state, _title, url) { this.lastUrl = url; } } }, URLSearchParams, encodeURIComponent, JSON,
  document: { getElementById: (id) => elements[id] },
  fetch: async (url, options) => {
    requests.push({ url, body: JSON.parse(options.body) });
    if (url.endsWith('/upload-asset')) return { ok: true, json: async () => ({ asset: { storagePath } }) };
    if (url.endsWith('/save-revision')) return { ok: true, json: async () => ({ revision: { id: documentId, revision: 1 } }) };
    if (url.endsWith('/publication-preview')) return { ok: true, json: async () => ({ preview: {
      revision: 1, artifact: { content: { content: { title: 'Ana y Luis' }, giftRegistry: { bank: { clabe: '123456789012345678' } } }, imageFields: ['photos.hero'] }
    } }) };
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
let requestedCloudProjectId = null;
let currentProjectId = null;
let currentConfig = { eventType: 'boda', name: 'Prueba', photos: { hero: 'data:image/png;base64,iVBORw0KGgo=' } };
let loadedCloudRevision = null;
let cloudLoadError = false;
let savedCloudDocumentId = null;
let cloudDirty = true;
let savedCloudConfig = null;
${cloudActions}
setupCloudActions();
setupProjectCreationAction();
`, context);

(async () => {
  assert.strictEqual(buttons.btnSaveCloud.hidden, true);
  assert.strictEqual(buttons.btnCreateCloud.hidden, false);
  await buttons.btnCreateCloud.handlers.click();
  assert.strictEqual(requests[0].url, '/api/projects/create');
  assert.strictEqual(requests[0].body.name, 'Prueba');
  assert.strictEqual(vm.runInContext('requestedCloudProjectId', context), projectId);
  assert.match(context.window.history.lastUrl, /project=20000000/);
  assert.strictEqual(buttons.btnCreateCloud.hidden, true);
  assert.strictEqual(buttons.btnSaveCloud.hidden, false);
  assert.strictEqual(buttons.btnPreviewPublication.hidden, false);
  await buttons.btnSaveCloud.handlers.click();
  assert.deepStrictEqual(requests.map((item) => item.url), ['/api/projects/create', '/api/projects/upload-asset', '/api/projects/save-revision']);
  assert.strictEqual(requests[2].body.document.legacy.config.photos.hero, storagePath);
  assert.strictEqual(requests[2].body.expectedRevision, 0);
  assert.strictEqual(vm.runInContext('cloudDirty', context), false);
  assert.match(vm.runInContext('currentConfig.photos.hero', context), /^\/api\/projects\/asset\?path=/);
  await buttons.btnPreviewPublication.handlers.click();
  assert.strictEqual(requests[3].url, '/api/projects/publication-preview');
  assert.strictEqual(requests[3].body.documentId, documentId);
  assert.strictEqual(previewDialog.opened, true);
  assert.match(previewSummary.textContent, /Ana y Luis/);
  assert.match(previewSummary.textContent, /123456789012345678/);
  assert.doesNotMatch(previewJson.textContent, /storagePath/);
  vm.runInContext('cloudDirty = true', context);
  await buttons.btnPreviewPublication.handlers.click();
  assert.strictEqual(requests.length, 4);
  vm.runInContext('cloudDirty = false', context);
  await buttons.btnPublishCloud.handlers.click();
  assert.strictEqual(requests[4].url, '/api/projects/publish-revision');
  assert.strictEqual(requests[4].body.documentId, documentId);
  const studioHtml = fs.readFileSync('./invitacion-estudio.html', 'utf8');
  assert.match(studioHtml, /id="publicationPreviewDialog"[^>]*aria-labelledby=/);
  assert.match(studioHtml, /id="btnPreviewPublication"/);
  console.log('Studio creates a private project, saves its first revision, and marks that revision published.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
