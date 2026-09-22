const assert = require('node:assert');
const { createProjectWithUserToken } = require('./lib/supabase-projects.cjs');
const { createProjectHandler } = require('./lib/create-project-handler.cjs');

const userId = '10000000-0000-4000-8000-000000000001';
const projectId = '20000000-0000-4000-8000-000000000001';
const config = { url: 'https://example.supabase.co', publishableKey: 'sb_publishable_test' };

(async () => {
  let request;
  const project = await createProjectWithUserToken({
    accessToken: 'user-token', userId, projectId, name: '  Boda de Catalina  ', eventType: 'wedding', config,
    fetchImpl: async (url, options) => {
      request = { url, options };
      return { ok: true, status: 201, json: async () => [{ id: projectId, name: 'Boda de Catalina', status: 'draft' }] };
    },
  });
  assert.strictEqual(project.id, projectId);
  assert.strictEqual(request.options.headers.Authorization, 'Bearer user-token');
  assert.strictEqual(request.options.method, 'POST');
  assert.deepStrictEqual(JSON.parse(request.options.body), {
    id: projectId, owner_user_id: userId, slug: `p-${projectId}`, name: 'Boda de Catalina', event_type: 'wedding',
  });

  await assert.rejects(createProjectWithUserToken({
    accessToken: 'user-token', userId, projectId, name: '', eventType: 'wedding', config,
    fetchImpl: async () => { throw Error('unexpected network'); },
  }), (error) => error.status === 422);

  const handler = createProjectHandler({
    authService: {
      ACCESS_COOKIE: 'invitta_access_token', parseCookies: () => ({ invitta_access_token: 'user-token' }),
      getAuthConfig: () => config, getAuthenticatedUser: async () => ({ id: userId }),
    },
    randomUUID: () => projectId,
    createProject: async (input) => {
      assert.strictEqual(input.userId, userId);
      return { id: input.projectId, name: input.name, status: 'draft' };
    },
  });
  const response = {
    code: null, headers: {}, body: null,
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.code = code; return this; },
    json(body) { this.body = body; return this; },
  };
  await handler({ method: 'POST', headers: { 'content-type': 'application/json' }, body: { name: 'Boda', eventType: 'wedding' } }, response);
  assert.strictEqual(response.code, 201);
  assert.strictEqual(response.body.project.id, projectId);
  assert.strictEqual(response.headers['Cache-Control'], 'no-store');
  console.log('Project creation uses a verified user JWT and server-generated identity.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
