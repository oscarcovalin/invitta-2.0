const assert = require('node:assert');
const fixture = require('./fixtures/invitation-document.v1.json');

const {
  ProjectRevisionError,
  saveRevisionWithUserToken,
} = require('./lib/supabase-project-revisions.cjs');
const { createProjectRevisionHandler } = require('./lib/project-revision-handler.cjs');

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
    config,
    fetchImpl: async (url, options) => {
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

  const invalid = structuredClone(fixture);
  invalid.projectId = 'not-a-uuid';
  let invalidCalled = false;
  await assert.rejects(
    saveRevisionWithUserToken({
      accessToken: 'token', userId, document: invalid, config,
      fetchImpl: async () => { invalidCalled = true; },
    }),
    (error) => error instanceof ProjectRevisionError && error.code === 'INVALID_DOCUMENT' && error.status === 422
  );
  assert.strictEqual(invalidCalled, false);

  await assert.rejects(
    saveRevisionWithUserToken({
      accessToken: 'token', userId, document: fixture, config,
      fetchImpl: async () => ({
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
    saveRevisionWithUserToken({ accessToken: '', userId, document: fixture, config, fetchImpl: async () => ({}) }),
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
    saveRevision: async (input) => ({ id: 'revision-id', project_id: input.document.projectId }),
  });
  const successfulResponse = responseRecorder();
  await handler({ method: 'POST', headers: { cookie: 'ignored=test' }, body: { document: fixture } }, successfulResponse);
  assert.strictEqual(successfulResponse.statusCode, 201);
  assert.deepStrictEqual(successfulResponse.body, {
    success: true,
    revision: { id: 'revision-id', project_id: fixture.projectId },
  });
  assert.deepStrictEqual(verifiedCalls, ['verified-access-token']);
  assert.strictEqual(successfulResponse.headers['Cache-Control'], 'no-store');

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
