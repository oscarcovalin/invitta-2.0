const assert = require('node:assert/strict');
const { listProjectsWithUserToken } = require('./lib/supabase-projects.cjs');
const { createListProjectsHandler } = require('./lib/list-projects-handler.cjs');

const config = { url: 'https://example.supabase.co', publishableKey: 'sb_publishable_test' };
const projects = [{ id: '20000000-0000-4000-8000-000000000003', name: 'Mis XV Janna', event_type: 'quinceanera', status: 'draft' }];

(async () => {
  let request;
  const listed = await listProjectsWithUserToken({
    accessToken: 'verified-user-token', config,
    fetchImpl: async (url, options) => {
      request = { url, options };
      return { ok: true, status: 200, json: async () => projects };
    },
  });
  assert.deepEqual(listed, projects);
  assert.match(request.url, /invitation_projects\?/);
  assert.match(request.url, /order=updated_at\.desc/);
  assert.equal(request.options.headers.Authorization, 'Bearer verified-user-token');
  await assert.rejects(
    listProjectsWithUserToken({ accessToken: '', config, fetchImpl: async () => { throw Error('unexpected network'); } }),
    (error) => error.status === 401
  );

  const handler = createListProjectsHandler({
    authService: {
      ACCESS_COOKIE: 'invitta_access_token',
      parseCookies: (header = '') => Object.fromEntries(String(header).split(';').map((part) => {
        const separator = part.indexOf('=');
        return separator < 0 ? ['', ''] : [part.slice(0, separator).trim(), part.slice(separator + 1).trim()];
      })),
      getAuthConfig: () => config,
      getAuthenticatedUser: async () => ({ id: '10000000-0000-4000-8000-000000000001' }),
    },
    listProjects: async ({ accessToken }) => {
      assert.equal(accessToken, 'verified-user-token');
      return projects;
    },
  });
  const response = {
    statusCode: null, headers: {}, body: null,
    setHeader(name, value) { this.headers[name] = value; return this; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
  await handler({ method: 'GET', headers: { cookie: 'invitta_access_token=verified-user-token' } }, response);
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body.projects, projects);
  assert.equal(response.headers['Cache-Control'], 'no-store');

  const anonymousResponse = { ...response, statusCode: null, body: null, headers: {} };
  await handler({ method: 'GET', headers: {} }, anonymousResponse);
  assert.equal(anonymousResponse.statusCode, 401);
  console.log('Project list is authenticated and receives only RLS-visible rows.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
