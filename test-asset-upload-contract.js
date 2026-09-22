const assert = require('assert');
const {
  MAX_ASSET_BYTES,
  prepareInvitationAsset
} = require('./lib/asset-upload-contract.js');

const projectId = '20000000-0000-4000-8000-000000000001';
const assetId = '30000000-0000-4000-8000-000000000001';
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);

const prepared = prepareInvitationAsset({
  projectId,
  assetId,
  slot: 'hero',
  declaredMimeType: 'image/png',
  bytes: png
});
assert.deepStrictEqual(prepared, {
  bucket: 'invitation-assets',
  storagePath: `${projectId}/hero/${assetId}.png`,
  mimeType: 'image/png',
  size: png.length
});

assert.throws(() => prepareInvitationAsset({
  projectId,
  assetId,
  slot: 'hero',
  declaredMimeType: 'image/jpeg',
  bytes: png
}), (error) => error.code === 'FILE_SIGNATURE_MISMATCH');

assert.throws(() => prepareInvitationAsset({
  projectId,
  assetId,
  slot: '../../avatars',
  declaredMimeType: 'image/png',
  bytes: png
}), (error) => error.code === 'INVALID_ASSET_SLOT');

assert.throws(() => prepareInvitationAsset({
  projectId: 'not-a-uuid',
  assetId,
  slot: 'hero',
  declaredMimeType: 'image/png',
  bytes: png
}), (error) => error.code === 'INVALID_PROJECT_ID');

assert.throws(() => prepareInvitationAsset({
  projectId,
  assetId,
  slot: 'hero',
  declaredMimeType: 'image/png',
  bytes: Buffer.alloc(MAX_ASSET_BYTES + 1)
}), (error) => error.code === 'FILE_TOO_LARGE');

console.log('Asset upload contract validates size, path and real file signatures.');
