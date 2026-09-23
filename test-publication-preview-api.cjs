const assert = require('node:assert/strict');
const { previewPublicationWithUserToken } = require('./lib/supabase-project-revisions.cjs');
const { createPublicationPreviewHandler } = require('./lib/publication-preview-handler.cjs');

const projectId = '20000000-0000-4000-8000-000000000001';
const documentId = '30000000-0000-4000-8000-000000000001';
const storagePath = `${projectId}/hero/${documentId}.webp`;
const document = {
  schemaVersion: 1, projectId, revision: 2,
  event: { type: 'wedding', startsAt: '2027-05-01T18:00:00-06:00', timeZone: 'America/Mexico_City' },
  content: { title: 'Ana y Luis', privateNote: 'SECRET_NOTE' }, design: {},
  sections: [{ id: 'hero', enabled: true }], assets: { hero: { storagePath } },
  legacy: { config: { photos: { hero: storagePath }, internalToken: 'SECRET_TOKEN' } },
};
const config = { url: 'https://example.supabase.co', publishableKey: 'sb_publishable_test' };

function response() {
  return { code: null, headers: {}, body: null, setHeader(k, v) { this.headers[k] = v; },
    status(n) { this.code = n; return this; }, json(v) { this.body = v; return this; } };
}

(async () => {
  let calls = 0;
  const preview = await previewPublicationWithUserToken({
    accessToken: 'owner-token', projectId, documentId, config,
    fetchImpl: async (url, options) => {
      calls++;
      assert.equal(options.method, 'GET');
      assert.equal(options.headers.Authorization, 'Bearer owner-token');
      assert.match(url, /invitation_documents/);
      return { ok: true, json: async () => [{ id: documentId, project_id: projectId, revision: 2, document }] };
    },
  });
  assert.equal(calls, 1);
  assert.equal(preview.revision, 2);
  assert.deepEqual(preview.artifact.imageFields, ['photos.hero']);
  assert.doesNotMatch(JSON.stringify(preview), /SECRET_|storagePath|invitation-assets|legacy/);

  const sample = structuredClone(document);
  sample.content.title = 'Catalina & Julián';
  await assert.rejects(previewPublicationWithUserToken({
    accessToken: 'owner-token', projectId, documentId, config,
    fetchImpl: async () => ({ ok: true, json: async () => [{ id: documentId, project_id: projectId, revision: 2, document: sample }] }),
  }), (error) => error.code === 'INVALID_PUBLICATION' && error.status === 422);
  await assert.rejects(previewPublicationWithUserToken({
    accessToken: 'owner-token', projectId, documentId, config,
    fetchImpl: async () => ({ ok: true, json: async () => [] }),
  }), (error) => error.code === 'PROJECT_ACCESS_DENIED' && error.status === 403);

  let readCalled = false;
  const handler = createPublicationPreviewHandler({
    authService: {
      ACCESS_COOKIE: 'session', parseCookies: () => ({ session: 'owner-token' }),
      getAuthConfig: () => config, getAuthenticatedUser: async () => ({ id: projectId }),
    },
    previewPublication: async () => { readCalled = true; return preview; },
  });
  const ok = response();
  await handler({ method: 'POST', headers: {}, body: { projectId, documentId } }, ok);
  assert.equal(ok.code, 200);
  assert.deepEqual(ok.body, { success: true, preview });
  assert.equal(ok.headers['Cache-Control'], 'no-store');
  assert.equal(readCalled, true);

  const off = createPublicationPreviewHandler({
    authService: { ACCESS_COOKIE: 'session', parseCookies: () => ({}) },
    previewPublication: async () => { throw new Error('must not read'); },
  });
  const denied = response();
  await off({ method: 'POST', headers: {}, body: { projectId, documentId } }, denied);
  assert.equal(denied.code, 401);
  const method = response();
  await handler({ method: 'GET', headers: {}, body: {} }, method);
  assert.equal(method.code, 405);
  console.log('Private publication preview returns only the public artifact after authentication.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
