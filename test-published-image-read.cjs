const assert = require('node:assert/strict');
const { readPublishedImage } = require('./lib/published-image-read.cjs');
const { createPublishedImageHandler } = require('./lib/published-image-handler.cjs');

const projectId = '20000000-0000-4000-8000-000000000001';
const documentId = '30000000-0000-4000-8000-000000000001';
const assetId = '40000000-0000-4000-8000-000000000001';
const storagePath = `${projectId}/hero/${assetId}.webp`;
const config = { url: 'https://example.supabase.co', secretKey: 'sb_secret_server_only' };
const project = { id: projectId, status: 'published', published_document_id: documentId };
const document = { schemaVersion: 1, projectId, sections: [{ id: 'hero', enabled: true }], assets: {}, legacy: { config: { photos: { hero: storagePath } } } };

function fakeFetch({ firstProject = project, lastProject = project, savedDocument = document } = {}) {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    assert.deepEqual(options.headers, { apikey: config.secretKey });
    if (url.includes('/invitation_projects?')) {
      const item = calls.filter((call) => call.url.includes('/invitation_projects?')).length === 1 ? firstProject : lastProject;
      return { ok: true, json: async () => item ? [item] : [] };
    }
    if (url.includes('/invitation_documents?')) return { ok: true, json: async () => savedDocument ? [{ document: savedDocument }] : [] };
    if (url.includes('/storage/v1/object/authenticated/')) return {
      ok: true, headers: { get: (name) => name === 'content-length' ? '4' : null },
      arrayBuffer: async () => Uint8Array.from([1, 2, 3, 4]).buffer,
    };
    throw new Error(`Unexpected request: ${url}`);
  };
  return { calls, fetchImpl };
}

(async () => {
  const success = fakeFetch();
  const image = await readPublishedImage({ slug: 'ana-luis', field: 'photos.hero', config, fetchImpl: success.fetchImpl });
  assert.equal(image.mimeType, 'image/webp');
  assert.deepEqual(image.bytes, Buffer.from([1, 2, 3, 4]));
  assert.equal(success.calls.length, 4);
  assert.match(success.calls[2].url, /invitation-assets\/20000000-0000-4000-8000-000000000001\/hero/);

  const sampleDocument = structuredClone(document);
  sampleDocument.content = { primaryName: 'Catalina' };
  const sample = fakeFetch({ savedDocument: sampleDocument });
  await assert.rejects(readPublishedImage({ slug: 'ana-luis', field: 'photos.hero', config, fetchImpl: sample.fetchImpl }),
    (error) => error.status === 404);
  assert.equal(sample.calls.length, 2);

  for (const [input, expectedCalls] of [
    [{ slug: '../private', field: 'photos.hero' }, 0],
    [{ slug: 'ana-luis', field: 'photos.gallery.0' }, 2],
  ]) {
    const attempt = fakeFetch();
    await assert.rejects(readPublishedImage({ ...input, config, fetchImpl: attempt.fetchImpl }), (error) => error.status === 404);
    assert.equal(attempt.calls.length, expectedCalls);
  }

  const draft = fakeFetch({ firstProject: { ...project, status: 'draft' } });
  await assert.rejects(readPublishedImage({ slug: 'ana-luis', field: 'photos.hero', config, fetchImpl: draft.fetchImpl }), (error) => error.status === 404);
  assert.equal(draft.calls.length, 1);

  const changed = fakeFetch({ lastProject: { ...project, published_document_id: assetId } });
  await assert.rejects(readPublishedImage({ slug: 'ana-luis', field: 'photos.hero', config, fetchImpl: changed.fetchImpl }), (error) => error.status === 404);

  const foreign = structuredClone(document);
  foreign.projectId = assetId;
  const wrongProject = fakeFetch({ savedDocument: foreign });
  await assert.rejects(readPublishedImage({ slug: 'ana-luis', field: 'photos.hero', config, fetchImpl: wrongProject.fetchImpl }), (error) => error.status === 404);
  assert.equal(wrongProject.calls.length, 2);

  const unsupported = fakeFetch({ savedDocument: { ...document, schemaVersion: 2 } });
  await assert.rejects(readPublishedImage({ slug: 'ana-luis', field: 'photos.hero', config, fetchImpl: unsupported.fetchImpl }), (error) => error.status === 404);
  assert.equal(unsupported.calls.length, 2);

  await assert.rejects(readPublishedImage({ slug: 'ana-luis', field: 'photos.hero', config: { url: config.url } }), (error) => error.status === 503);

  const handler = createPublishedImageHandler({ readImage: async () => image, env: {} });
  const response = { code: null, headers: {}, body: null, setHeader(k, v) { this.headers[k] = v; }, status(n) { this.code = n; return this; }, json(v) { this.body = v; return this; }, send(v) { this.body = v; return this; } };
  await handler({ method: 'GET', query: { slug: 'ana-luis', field: 'photos.hero' } }, response);
  assert.equal(response.code, 503);
  assert.equal(response.headers['Cache-Control'], 'no-store');

  let received;
  const enabledHandler = createPublishedImageHandler({
    env: { INVITTA_PUBLIC_ASSETS_ENABLED: '1', INVITTA_PUBLIC_ASSET_PREVIEW_SLUG: 'ana-luis', SUPABASE_URL: config.url, SUPABASE_SECRET_KEY: config.secretKey },
    readImage: async (input) => { received = input; return image; },
  });
  const enabledResponse = { ...response, code: null, headers: {}, body: null };
  await enabledHandler({ method: 'GET', query: { slug: 'ana-luis', field: 'photos.hero' } }, enabledResponse);
  assert.equal(enabledResponse.code, 200);
  assert.equal(enabledResponse.headers['Content-Type'], 'image/webp');
  assert.deepEqual(enabledResponse.body, image.bytes);
  assert.deepEqual(received, { slug: 'ana-luis', field: 'photos.hero', config });

  const wrongSlugResponse = { ...response, code: null, headers: {}, body: null };
  await enabledHandler({ method: 'GET', query: { slug: 'otro-evento', field: 'photos.hero' } }, wrongSlugResponse);
  assert.equal(wrongSlugResponse.code, 404);

  const methodResponse = { ...response, code: null, headers: {}, body: null };
  await enabledHandler({ method: 'POST', query: {} }, methodResponse);
  assert.equal(methodResponse.code, 405);
  console.log('Published image reads require the current published revision and remain disabled by default.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
