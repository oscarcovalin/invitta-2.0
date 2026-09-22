const assert = require('node:assert');
const { uploadProjectAsset } = require('./lib/project-asset-upload.cjs');
const { createAssetUploadHandler } = require('./lib/project-asset-upload-handler.cjs');

const projectId = '20000000-0000-4000-8000-000000000001';
const assetId = '30000000-0000-4000-8000-000000000001';
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const config = { url: 'https://example.supabase.co', publishableKey: 'sb_publishable_test' };

(async () => {
  let request;
  const result = await uploadProjectAsset({
    projectId, assetId, slot: 'hero', mimeType: 'image/png', base64: png.toString('base64'),
    accessToken: 'user-token', config,
    fetchImpl: async (url, options) => {
      request = { url, options };
      return { ok: true, status: 200 };
    },
  });
  assert.strictEqual(result.storagePath, `${projectId}/hero/${assetId}.png`);
  assert.strictEqual(request.url, `https://example.supabase.co/storage/v1/object/invitation-assets/${result.storagePath}`);
  assert.strictEqual(request.options.headers.Authorization, 'Bearer user-token');
  assert.strictEqual(request.options.headers['Content-Type'], 'image/png');
  assert.deepStrictEqual(request.options.body, png);

  await assert.rejects(uploadProjectAsset({
    projectId, assetId, slot: 'hero', mimeType: 'image/jpeg', base64: png.toString('base64'),
    accessToken: 'user-token', config, fetchImpl: async () => { throw new Error('unexpected network'); },
  }), (error) => error.code === 'FILE_SIGNATURE_MISMATCH');

  await assert.rejects(uploadProjectAsset({
    projectId, assetId, slot: 'hero', mimeType: 'image/png', base64: png.toString('base64'),
    accessToken: 'user-token', config,
    fetchImpl: async () => ({ ok: false, status: 403 }),
  }), (error) => error.code === 'PROJECT_ACCESS_DENIED' && error.status === 403);

  const handler = createAssetUploadHandler({
    authService: {
      ACCESS_COOKIE: 'invitta_access_token',
      parseCookies: () => ({ invitta_access_token: 'user-token' }),
      getAuthConfig: () => config,
      getAuthenticatedUser: async () => ({ id: '10000000-0000-4000-8000-000000000001' }),
    },
    uploadAsset: async (input) => ({ storagePath: `${input.projectId}/hero/file.png` }),
    randomUUID: () => assetId,
  });
  const res = {
    code: null, body: null, headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.code = code; return this; },
    json(body) { this.body = body; return this; },
  };
  await handler({
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: { projectId, slot: 'hero', mimeType: 'image/png', base64: png.toString('base64') },
  }, res);
  assert.strictEqual(res.code, 201);
  assert.strictEqual(res.body.asset.storagePath, `${projectId}/hero/file.png`);
  assert.strictEqual(res.headers['Cache-Control'], 'no-store');

  console.log('Private asset uploads validate bytes and retain user RLS.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
