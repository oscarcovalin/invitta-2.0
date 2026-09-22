const assert = require('node:assert');
const fs = require('node:fs');
const vm = require('node:vm');

const projectId = '20000000-0000-4000-8000-000000000001';
const assetId = '30000000-0000-4000-8000-000000000001';
const storagePath = `${projectId}/hero/${assetId}.png`;
const context = { window: {}, URLSearchParams, encodeURIComponent, JSON };
vm.createContext(context);
vm.runInContext(fs.readFileSync('./project-asset-client.js', 'utf8'), context);
const client = context.window.ProjectAssetClient;

(async () => {
  const display = client.toDisplayConfig({ photos: { hero: storagePath } });
  assert.strictEqual(display.photos.hero, `/api/projects/asset?path=${encodeURIComponent(storagePath)}`);
  const stored = await client.toStoredConfig(display, { projectId, upload: async () => { throw Error('unexpected upload'); } });
  assert.strictEqual(stored.photos.hero, storagePath);

  const uploadCalls = [];
  const inline = 'data:image/png;base64,iVBORw0KGgo=';
  const migrated = await client.toStoredConfig({ photos: { hero: inline } }, {
    projectId,
    upload: async (asset) => { uploadCalls.push(asset); return { storagePath }; },
  });
  assert.strictEqual(migrated.photos.hero, storagePath);
  assert.strictEqual(uploadCalls[0].slot, 'hero');
  assert.strictEqual(uploadCalls[0].mimeType, 'image/png');
  assert.strictEqual(uploadCalls[0].base64, 'iVBORw0KGgo=');

  await assert.rejects(client.toStoredConfig({ photos: { hero: 'https://example.com/photo.jpg' } }, {
    projectId, upload: async () => { throw Error('unexpected upload'); },
  }), /photos.hero/);
  assert.strictEqual(client.toDisplayConfig({ photos: { hero: '../bad.jpg' } }).photos.hero, '../bad.jpg');
  console.log('Private asset client converts paths for display and upload without losing external URLs.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
