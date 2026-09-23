const assert = require('node:assert');
const fixture = require('./fixtures/invitation-document.v1.json');

const {
  ProjectRevisionError,
  getLatestRevisionWithUserToken,
  publishRevisionWithUserToken,
  saveRevisionWithUserToken,
} = require('./lib/supabase-project-revisions.cjs');
const { createProjectRevisionHandler } = require('./lib/project-revision-handler.cjs');
const { createPublishRevisionHandler } = require('./lib/publish-revision-handler.cjs');
const { createLatestRevisionHandler } = require('./lib/latest-revision-handler.cjs');

const config = {
  url: 'https://example.supabase.co',
  publishableKey: 'sb_publishable_test',
};
const userId = '10000000-0000-4000-8000-000000000001';

(async () => {
  let request;
  const saved = await saveRevisionWithUserToken({
    accessToken: 'user-access-token',
    userId,
    document: fixture,
    expectedRevision: 0,
    config,
    fetchImpl: async (url, options) => {
      if (options.method === 'GET') return { ok: true, status: 200, json: async () => [] };
      request = { url, options };
      return {
        ok: true,
        status: 201,
        json: async () => [{
          id: '30000000-0000-4000-8000-000000000001',
          project_id: fixture.projectId,
          revision: fixture.revision,
        }],
      };
    },
  });

  assert.strictEqual(
    request.url,
    'https://example.supabase.co/rest/v1/invitation_documents?select=id%2Cproject_id%2Crevision%2Cschema_version%2Ccreated_by%2Ccreated_at'
  );
  assert.strictEqual(request.options.headers.apikey, config.publishableKey);
  assert.strictEqual(request.options.headers.Authorization, 'Bearer user-access-token');
  assert.strictEqual(request.options.headers.Prefer, 'return=representation');
  assert.deepStrictEqual(JSON.parse(request.options.body), {
    project_id: fixture.projectId,
    revision: fixture.revision,
    schema_version: fixture.schemaVersion,
    document: fixture,
    created_by: userId,
  });
  assert.strictEqual(saved.project_id, fixture.projectId);

  let conflictWrote = false;
  await assert.rejects(
    saveRevisionWithUserToken({
      accessToken: 'token', userId, document: fixture, expectedRevision: 0, config,
      fetchImpl: async (_url, options) => {
        if (options.method === 'GET') return { ok: true, status: 200, json: async () => [{ revision: 2 }] };
        conflictWrote = true;
      },
    }),
    (error) => error.code === 'REVISION_CONFLICT' && error.status === 409
  );
  assert.strictEqual(conflictWrote, false);

  await assert.rejects(
    saveRevisionWithUserToken({ accessToken: 'token', userId, document: fixture, expectedRevision: 1, config }),
    (error) => error.code === 'INVALID_REVISION' && error.status === 422
  );

  const invalid = structuredClone(fixture);
  invalid.projectId = 'not-a-uuid';
  let invalidCalled = false;
  await assert.rejects(
    saveRevisionWithUserToken({
      accessToken: 'token', userId, document: invalid, expectedRevision: 0, config,
      fetchImpl: async () => { invalidCalled = true; },
    }),
    (error) => error instanceof ProjectRevisionError && error.code === 'INVALID_DOCUMENT' && error.status === 422
  );
  assert.strictEqual(invalidCalled, false);

  await assert.rejects(
    saveRevisionWithUserToken({
      accessToken: 'token', userId, document: fixture, expectedRevision: 0, config,
      fetchImpl: async (_url, options) => options.method === 'GET'
        ? { ok: true, status: 200, json: async () => [] }
        : ({
        ok: false,
        status: 403,
        json: async () => ({ code: '42501', message: 'private database detail' }),
      }),
    }),
    (error) => error.code === 'PROJECT_ACCESS_DENIED'
      && error.status === 403
      && !error.message.includes('private database detail')
  );

  await assert.rejects(
    saveRevisionWithUserToken({ accessToken: '', userId, document: fixture, expectedRevision: 0, config, fetchImpl: async () => ({}) }),
    (error) => error.code === 'UNAUTHENTICATED' && error.status === 401
  );

  function responseRecorder() {
    return {
      statusCode: 200,
      headers: {},
      body: null,
      setHeader(name, value) { this.headers[name] = value; },
      status(code) { this.statusCode = code; return this; },
      json(body) { this.body = body; return this; },
    };
  }

  const verifiedCalls = [];
  let receivedExpectedRevision;
  const handler = createProjectRevisionHandler({
    authService: {
      ACCESS_COOKIE: 'invitta_access_token',
      getAuthConfig: () => config,
      parseCookies: () => ({ invitta_access_token: 'verified-access-token' }),
      getAuthenticatedUser: async ({ accessToken }) => {
        verifiedCalls.push(accessToken);
        return { id: userId };
      },
    },
    saveRevision: async (input) => {
      receivedExpectedRevision = input.expectedRevision;
      return { id: 'revision-id', project_id: input.document.projectId };
    },
  });
  const successfulResponse = responseRecorder();
  await handler({ method: 'POST', headers: { cookie: 'ignored=test' }, body: { document: fixture, expectedRevision: 0 } }, successfulResponse);
  assert.strictEqual(successfulResponse.statusCode, 201);
  assert.deepStrictEqual(successfulResponse.body, {
    success: true,
    revision: { id: 'revision-id', project_id: fixture.projectId },
  });
  assert.deepStrictEqual(verifiedCalls, ['verified-access-token']);
  assert.strictEqual(receivedExpectedRevision, 0);
  assert.strictEqual(successfulResponse.headers['Cache-Control'], 'no-store');

  const documentId = '30000000-0000-4000-8000-000000000001';
  const publishableDocument = structuredClone(fixture);
  publishableDocument.content.title = 'Ana y Luis';
  publishableDocument.event.startsAt = '2027-05-01T18:00:00-06:00';
  let publishRequest;
  let publishRead;
  const published = await publishRevisionWithUserToken({
    accessToken: 'owner-access-token',
    projectId: fixture.projectId,
    documentId,
    config,
    fetchImpl: async (url, options) => {
      if (options.method === 'GET') {
        publishRead = { url, options };
        return { ok: true, status: 200, json: async () => [{
          id: documentId, project_id: fixture.projectId, revision: 1,
          document: publishableDocument,
        }] };
      }
      publishRequest = { url, options };
      return {
        ok: true,
        status: 200,
        json: async () => [{ id: fixture.projectId, published_document_id: documentId, status: 'published' }],
      };
    },
  });
  assert.ok(publishRead.url.includes(`id=eq.${documentId}`));
  assert.ok(publishRead.url.includes(`project_id=eq.${fixture.projectId}`));
  assert.strictEqual(publishRead.options.headers.Authorization, 'Bearer owner-access-token');
  assert.strictEqual(
    publishRequest.url,
    `https://example.supabase.co/rest/v1/invitation_projects?id=eq.${fixture.projectId}&select=id%2Cpublished_document_id%2Cstatus%2Cupdated_at`
  );
  assert.strictEqual(publishRequest.options.method, 'PATCH');
  assert.strictEqual(publishRequest.options.headers.Authorization, 'Bearer owner-access-token');
  assert.deepStrictEqual(JSON.parse(publishRequest.options.body), {
    published_document_id: documentId,
    status: 'published',
  });
  assert.strictEqual(published.status, 'published');

  for (const [rejectedDocument, expectedCode] of [
    [{ ...publishableDocument, content: { primaryName: 'Catalina' } }, 'PUBLICATION_SAMPLE_DATA'],
    [{ ...publishableDocument, legacy: { config: { eventDateLabel: '2 de Mayo, 2027' } } }, 'PUBLICATION_DATE_MISMATCH'],
    [{ ...publishableDocument, assets: { hero: { storagePath: `${documentId}/hero/${documentId}.webp` } } }, 'INVALID_PUBLICATION'],
  ]) {
    let patchCalled = false;
    await assert.rejects(publishRevisionWithUserToken({
      accessToken: 'owner-access-token', projectId: fixture.projectId, documentId, config,
      fetchImpl: async (_url, options) => {
        if (options.method === 'PATCH') patchCalled = true;
        return { ok: true, status: 200, json: async () => [{
          id: documentId, project_id: fixture.projectId, revision: 1, document: rejectedDocument,
        }] };
      },
    }), (error) => error.code === expectedCode && error.status === 422);
    assert.strictEqual(patchCalled, false);
  }

  for (const readResponse of [
    { ok: true, status: 200, json: async () => [] },
    { ok: false, status: 502, json: async () => ({ message: 'private database detail' }) },
  ]) {
    let patchCalled = false;
    await assert.rejects(publishRevisionWithUserToken({
      accessToken: 'owner-access-token', projectId: fixture.projectId, documentId, config,
      fetchImpl: async (_url, options) => {
        if (options.method === 'PATCH') patchCalled = true;
        return readResponse;
      },
    }), (error) => (error.code === 'PROJECT_ACCESS_DENIED' || error.code === 'REVISION_LOAD_FAILED')
      && !error.message.includes('private database detail'));
    assert.strictEqual(patchCalled, false);
  }

  let loadRequest;
  const latest = await getLatestRevisionWithUserToken({
    accessToken: 'member-token', projectId: fixture.projectId, config,
    fetchImpl: async (url, options) => {
      loadRequest = { url, options };
      return { ok: true, status: 200, json: async () => [{ id: documentId, revision: 3, document: fixture }] };
    },
  });
  assert.ok(loadRequest.url.includes(`project_id=eq.${fixture.projectId}`));
  assert.ok(loadRequest.url.includes('order=revision.desc'));
  assert.strictEqual(loadRequest.options.headers.Authorization, 'Bearer member-token');
  assert.strictEqual(latest.revision, 3);

  await assert.rejects(
    getLatestRevisionWithUserToken({
      accessToken: 'outsider-token', projectId: fixture.projectId, config,
      fetchImpl: async () => ({ ok: true, status: 200, json: async () => [] }),
    }),
    (error) => error.code === 'REVISION_NOT_FOUND' && error.status === 404
  );

  await assert.rejects(
    publishRevisionWithUserToken({
      accessToken: 'planner-token', projectId: fixture.projectId, documentId, config,
      fetchImpl: async () => ({ ok: true, status: 200, json: async () => [] }),
    }),
    (error) => error.code === 'PROJECT_ACCESS_DENIED' && error.status === 403
  );

  const publishHandler = createPublishRevisionHandler({
    authService: {
      ACCESS_COOKIE: 'invitta_access_token',
      getAuthConfig: () => config,
      parseCookies: () => ({ invitta_access_token: 'owner-access-token' }),
      getAuthenticatedUser: async () => ({ id: userId }),
    },
    publishRevision: async (input) => ({
      id: input.projectId,
      published_document_id: input.documentId,
      status: 'published',
    }),
  });
  const publishResponse = responseRecorder();
  await publishHandler({
    method: 'POST', headers: {}, body: { projectId: fixture.projectId, documentId },
  }, publishResponse);
  assert.strictEqual(publishResponse.statusCode, 200);
  assert.strictEqual(publishResponse.body.project.status, 'published');

  const loadHandler = createLatestRevisionHandler({
    authService: {
      ACCESS_COOKIE: 'invitta_access_token',
      getAuthConfig: () => config,
      parseCookies: () => ({ invitta_access_token: 'member-token' }),
      getAuthenticatedUser: async () => ({ id: userId }),
    },
    loadRevision: async ({ projectId }) => ({ project_id: projectId, revision: 3, document: fixture }),
  });
  const loadResponse = responseRecorder();
  await loadHandler({
    method: 'GET', headers: {}, query: { projectId: fixture.projectId },
  }, loadResponse);
  assert.strictEqual(loadResponse.statusCode, 200);
  assert.strictEqual(loadResponse.body.revision.revision, 3);
  assert.strictEqual(loadResponse.headers['Cache-Control'], 'no-store');

  const unauthenticatedHandler = createProjectRevisionHandler({
    authService: {
      ACCESS_COOKIE: 'invitta_access_token',
      getAuthConfig: () => config,
      parseCookies: () => ({}),
      getAuthenticatedUser: async () => { throw new Error('must not be called'); },
    },
    saveRevision: async () => { throw new Error('must not be called'); },
  });
  const unauthenticatedResponse = responseRecorder();
  await unauthenticatedHandler({ method: 'POST', headers: {}, body: { document: fixture } }, unauthenticatedResponse);
  assert.strictEqual(unauthenticatedResponse.statusCode, 401);
  assert.deepStrictEqual(unauthenticatedResponse.body, { success: false, error: 'Sesión no válida.' });

  console.log('Project revision writes use the user JWT and preserve RLS isolation.');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
