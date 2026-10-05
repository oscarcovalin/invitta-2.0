const assert = require('node:assert');
const fs = require('node:fs');
const vm = require('node:vm');
const { projectPublicInvitation } = require('./lib/public-invitation-projection.cjs');

const projectId = '20000000-0000-4000-8000-000000000001';
const assetId = '30000000-0000-4000-8000-000000000001';
const storagePath = `${projectId}/hero/${assetId}.png`;
const context = { window: {}, URL, URLSearchParams, encodeURIComponent, JSON, Uint8Array, btoa };
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

  const audioPath = `${projectId}/music/${assetId}.mp3`;
  const audioUploads = [];
  const storedMusic = await client.toStoredConfig({ music: { url: 'data:audio/mpeg;base64,SUQz', title: 'Vals' } }, {
    projectId,
    upload: async (asset) => { audioUploads.push(asset); return { storagePath: audioPath }; },
  });
  assert.strictEqual(storedMusic.music.url, audioPath);
  assert.deepStrictEqual(audioUploads.map(({ slot, mimeType, base64 }) => ({ slot, mimeType, base64 })), [
    { slot: 'music', mimeType: 'audio/mpeg', base64: 'SUQz' },
  ]);
  assert.strictEqual(client.toDisplayConfig({ music: { url: audioPath } }).music.url,
    `/api/projects/asset?path=${encodeURIComponent(audioPath)}`);
  assert.strictEqual(client.MAX_AUDIO_BYTES, 3300000);
  await assert.rejects(client.toStoredConfig({ music: { url: `data:audio/mpeg;base64,${'A'.repeat(4400008)}` } }, {
    projectId,
    upload: async () => { throw Error('oversized audio must not upload'); },
  }), /3.3 MB/);
  await assert.rejects(client.toStoredConfig({ other: { data: 'data:audio/mpeg;base64,SUQz' } }, {
    projectId,
    upload: async () => { throw Error('audio outside music field must not upload'); },
  }), /JPG, PNG, WebP o GIF/);

  vm.runInContext(fs.readFileSync('./invitation-document-adapter.js', 'utf8'), context);
  const venuePaths = {
    ceremony: `${projectId}/ceremony/${assetId}.png`,
    reception: `${projectId}/reception/${assetId}.png`,
  };
  const venueUploads = [];
  const storedVenues = await client.toStoredConfig({
    ceremony: { venue: 'Capilla Santa Ana', address: 'Calle Uno', time: '18:00', image: inline },
    reception: { venue: 'Salón Jardín', address: 'Calle Dos', time: '20:00', image: inline },
  }, {
    projectId,
    upload: async ({ slot }) => { venueUploads.push(slot); return { storagePath: venuePaths[slot] }; },
  });
  assert.deepStrictEqual(venueUploads, ['ceremony', 'reception']);
  const venueDocument = context.window.InvitationDocumentAdapter.fromLegacyTemplateConfig(storedVenues, { projectId }).document;
  const venuePreview = projectPublicInvitation(venueDocument);
  assert.deepStrictEqual(venuePreview.details, {
    ceremony: { venue: 'Capilla Santa Ana', address: 'Calle Uno', time: '18:00' },
    reception: { venue: 'Salón Jardín', address: 'Calle Dos', time: '20:00' },
  });
  assert.strictEqual(JSON.stringify(venuePreview).includes(venuePaths.ceremony), false);
  const restoredVenues = context.window.InvitationDocumentAdapter.toLegacyTemplateConfig(venueDocument);
  for (const location of ['ceremony', 'reception']) {
    assert.strictEqual(restoredVenues[location].venue, storedVenues[location].venue);
    assert.strictEqual(restoredVenues[location].address, storedVenues[location].address);
    assert.strictEqual(restoredVenues[location].time, storedVenues[location].time);
    assert.strictEqual(restoredVenues[location].image, venuePaths[location]);
    assert.strictEqual(client.toDisplayConfig(restoredVenues)[location].image,
      `/api/projects/asset?path=${encodeURIComponent(venuePaths[location])}`);
  }

  const imported = await client.toStoredConfig({ photos: { hero: 'https://example.com/photo.jpg' } }, {
    projectId,
    importRemote: async (url) => {
      assert.strictEqual(url, 'https://example.com/photo.jpg');
      return { mimeType: 'image/png', base64: 'iVBORw0KGgo=' };
    },
    upload: async () => ({ storagePath }),
  });
  assert.strictEqual(imported.photos.hero, storagePath);

  vm.runInContext(fs.readFileSync('./template-engine.js', 'utf8') + '; globalThis.defaultInvitationConfig = TemplateEngine.defaultConfig;', context);
  const bundledFontConfig = { typography: context.defaultInvitationConfig.typography };
  const bundledFontStored = await client.toStoredConfig(bundledFontConfig, {
    projectId,
    upload: async () => { throw Error('Bundled font must not need a private upload'); },
  });
  assert.strictEqual(bundledFontStored.typography.customNamesFile, 'assets/cherolina.ttf');
  assert.ok(fs.existsSync('./assets/cherolina.ttf'));
  const defaultStored = await client.toStoredConfig(context.defaultInvitationConfig, {
    projectId,
    importRemote: async () => ({ mimeType: 'image/png', base64: 'iVBORw0KGgo=' }),
    upload: async ({ slot }) => ({ storagePath: `${projectId}/${slot}/${assetId}.png` }),
  });
  assert.strictEqual(defaultStored.typography.customNamesFile, 'assets/cherolina.ttf');
  const firstRevision = context.window.InvitationDocumentAdapter.fromLegacyTemplateConfig(defaultStored, { projectId });
  assert.strictEqual(firstRevision.pendingAssets.length, 0);

  let remoteRequest;
  const remoteImage = await client.importRemoteImage('https://images.example.com/photo.png', async (url, options) => {
    remoteRequest = { url, options };
    return {
      ok: true,
      headers: { get: (name) => name === 'content-type' ? 'image/png' : '8' },
      arrayBuffer: async () => Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]).buffer,
    };
  });
  assert.strictEqual(remoteImage.mimeType, 'image/png');
  assert.strictEqual(remoteImage.base64, 'iVBORw0KGgo=');
  assert.strictEqual(remoteRequest.options.credentials, 'omit');
  assert.strictEqual(remoteRequest.options.redirect, 'error');
  await assert.rejects(client.importRemoteImage('http://localhost/private.png', async () => {
    throw Error('unexpected fetch');
  }), /HTTPS/);

  await assert.rejects(client.toStoredConfig({ photos: { hero: 'https://example.com/photo.jpg' } }, {
    projectId, upload: async () => { throw Error('unexpected upload'); },
  }), /photos.hero/);
  assert.strictEqual(client.toDisplayConfig({ photos: { hero: '../bad.jpg' } }).photos.hero, '../bad.jpg');
  console.log('Private asset client converts paths for display and upload without losing external URLs.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
