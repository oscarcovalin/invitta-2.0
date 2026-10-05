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

const mp3 = Buffer.from([0x49, 0x44, 0x33, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xff, 0xfb, 0x90, 0x64]);
const preparedMusic = prepareInvitationAsset({
  projectId,
  assetId,
  slot: 'music',
  declaredMimeType: 'audio/mpeg',
  bytes: mp3
});
assert.deepStrictEqual(preparedMusic, {
  bucket: 'invitation-music',
  storagePath: `${projectId}/music/${assetId}.mp3`,
  mimeType: 'audio/mpeg',
  size: mp3.length
});

assert.throws(() => prepareInvitationAsset({
  projectId,
  assetId,
  slot: 'music',
  declaredMimeType: 'audio/mpeg',
  bytes: Buffer.from('not an mp3')
}), (error) => error.code === 'FILE_SIGNATURE_MISMATCH');

assert.throws(() => prepareInvitationAsset({
  projectId,
  assetId,
  slot: 'hero',
  declaredMimeType: 'audio/mpeg',
  bytes: mp3
}), (error) => error.code === 'FILE_SIGNATURE_MISMATCH');

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
