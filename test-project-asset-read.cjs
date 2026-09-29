const assert = require('node:assert');
const { readProjectAsset } = require('./lib/project-asset-read.cjs');
const { createAssetReadHandler } = require('./lib/project-asset-read-handler.cjs');

const projectId = '20000000-0000-4000-8000-000000000001';
const assetId = '30000000-0000-4000-8000-000000000001';
const path = `${projectId}/hero/${assetId}.png`;
const config = { url: 'https://example.supabase.co', publishableKey: 'sb_publishable_test' };

(async () => {
  let readUrl;
  const image = await readProjectAsset({
    path, accessToken: 'user-token', config,
    fetchImpl: async (url, options) => {
      readUrl = url;
      assert.strictEqual(options.headers.Authorization, 'Bearer user-token');
      return { ok: true, headers: { get: () => 'image/png' }, arrayBuffer: async () => Uint8Array.from([137, 80, 78, 71]).buffer };
    },
  });
  assert.strictEqual(readUrl, `https://example.supabase.co/storage/v1/object/authenticated/invitation-assets/${path}`);
  assert.strictEqual(image.mimeType, 'image/png');
  assert.deepStrictEqual(image.bytes, Buffer.from([137, 80, 78, 71]));

  const musicPath = `${projectId}/music/${assetId}.mp3`;
  const music = await readProjectAsset({
    path: musicPath, accessToken: 'user-token', config,
    fetchImpl: async (url, options) => {
      readUrl = url;
      assert.strictEqual(options.headers.Authorization, 'Bearer user-token');
      return { ok: true, headers: { get: () => '14' }, arrayBuffer: async () => Uint8Array.from([0x49, 0x44, 0x33, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xff, 0xfb, 0x90, 0x64]).buffer };
    },
  });
  assert.strictEqual(music.mimeType, 'audio/mpeg');
  assert.deepStrictEqual(music.bytes, Buffer.from([0x49, 0x44, 0x33, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xff, 0xfb, 0x90, 0x64]));
  assert.strictEqual(readUrl, `https://example.supabase.co/storage/v1/object/authenticated/invitation-music/${musicPath}`);

  await assert.rejects(readProjectAsset({ path: '../secret', accessToken: 'user-token', config }),
    (error) => error.status === 422);
  await assert.rejects(readProjectAsset({
    path, accessToken: 'user-token', config,
    fetchImpl: async () => ({ ok: false, status: 403 }),
  }), (error) => error.status === 403);

  const handler = createAssetReadHandler({
    authService: {
      ACCESS_COOKIE: 'invitta_access_token', parseCookies: () => ({ invitta_access_token: 'user-token' }),
      getAuthConfig: () => config, getAuthenticatedUser: async () => ({ id: 'user-id' }),
    },
    readAsset: async () => image,
  });
  const res = {
    code: null, headers: {}, body: null,
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.code = code; return this; },
    send(body) { this.body = body; return this; },
    json(body) { this.body = body; return this; },
  };
  await handler({ method: 'GET', headers: {}, query: { path } }, res);
  assert.strictEqual(res.code, 200);
  assert.strictEqual(res.headers['Content-Type'], 'image/png');
  assert.strictEqual(res.headers['Cache-Control'], 'private, no-store');
  assert.deepStrictEqual(res.body, image.bytes);
  console.log('Private asset reads preserve user RLS and disable shared caching.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
