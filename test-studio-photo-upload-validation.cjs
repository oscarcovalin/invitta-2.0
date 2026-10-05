const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('./app.js', 'utf8');
const start = source.indexOf('function setupFileUploads()');
const end = source.indexOf('// ==================== PREVIEW GENERATOR', start);
assert.ok(start >= 0 && end > start);

function setup() {
  const listeners = new Map();
  const elements = new Map();
  for (const id of ['fileCeremonyImage', 'inputCeremonyImage', 'btnClearCeremonyImage',
    'fileReceptionImage', 'inputReceptionImage', 'btnClearReceptionImage']) {
    elements.set(id, { value: '', addEventListener(type, handler) { listeners.set(`${id}:${type}`, handler); } });
  }
  const config = { ceremony: { image: '' }, reception: { image: '' } };
  const toasts = [];
  let reads = 0;
  let updates = 0;
  class FakeReader {
    readAsDataURL(file) {
      reads++;
      this.onload({ target: { result: `data:${file.type};base64,AAAA` } });
    }
  }
  const context = {
    document: { getElementById: (id) => elements.get(id) || null },
    currentConfig: config,
    setObjectPath(target, path, value) { const [parent, key] = path.split('.'); target[parent][key] = value; },
    schedulePreviewUpdate() { updates++; },
    showToast(message) { toasts.push(message); },
    FileReader: FakeReader,
  };
  vm.runInNewContext(`${source.slice(start, end)}\nsetupFileUploads();`, context);
  return { listeners, elements, config, toasts, get reads() { return reads; }, get updates() { return updates; } };
}

const ui = setup();
const ceremonyUpload = ui.listeners.get('fileCeremonyImage:change');
const receptionUpload = ui.listeners.get('fileReceptionImage:change');
assert.equal(typeof ceremonyUpload, 'function');
assert.equal(typeof receptionUpload, 'function');

ceremonyUpload({ target: { files: [{ type: 'image/svg+xml', size: 10 }] } });
receptionUpload({ target: { files: [{ type: 'image/jpeg', size: 3 * 1024 * 1024 + 1 }] } });
assert.equal(ui.reads, 0, 'unsupported or oversized photos must not be read');
assert.equal(ui.updates, 0);

ceremonyUpload({ target: { files: [{ type: 'image/png', size: 4 }] } });
assert.equal(ui.config.ceremony.image, 'data:image/png;base64,AAAA');
assert.equal(ui.reads, 1);
ui.listeners.get('btnClearCeremonyImage:click')();
assert.equal(ui.config.ceremony.image, '');
assert.equal(ui.elements.get('inputCeremonyImage').value, '');
console.log('Studio venue photo uploads reject invalid files and support load and clear.');
