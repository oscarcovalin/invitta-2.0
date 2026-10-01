const assert = require('node:assert/strict');
const auth = require('./lib/supabase-auth-service.cjs');
const fixture = require('./fixtures/invitation-document.v1.json');

const config = { url: 'https://auth.example.test', publishableKey: 'test-publishable' };
const user = { id: '10000000-0000-4000-8000-000000000001', email: 'owner@example.test' };
const routes = [
  ['save', './lib/project-revision-handler.cjs', 'createProjectRevisionHandler', 'saveRevision', 'POST', 201],
  ['publish', './lib/publish-revision-handler.cjs', 'createPublishRevisionHandler', 'publishRevision', 'POST', 200],
  ['preview', './lib/publication-preview-handler.cjs', 'createPublicationPreviewHandler', 'previewPublication', 'POST', 200],
  ['load revision', './lib/latest-revision-handler.cjs', 'createLatestRevisionHandler', 'loadRevision', 'GET', 200],
  ['list', './lib/list-projects-handler.cjs', 'createListProjectsHandler', 'listProjects', 'GET', 200],
  ['load project', './lib/get-project-handler.cjs', 'createGetProjectHandler', 'getProject', 'GET', 200],
  ['create', './lib/create-project-handler.cjs', 'createProjectHandler', 'createProject', 'POST', 201],
  ['upload', './lib/project-asset-upload-handler.cjs', 'createAssetUploadHandler', 'uploadAsset', 'POST', 201],
  ['read asset', './lib/project-asset-read-handler.cjs', 'createAssetReadHandler', 'readAsset', 'GET', 200],
  ['list RSVPs', './lib/project-rsvps-handler.cjs', 'createProjectRsvpsHandler', 'listRsvps', 'GET', 200],
  ['delete RSVP', './lib/project-rsvps-handler.cjs', 'createProjectRsvpsHandler', 'deleteRsvp', 'DELETE', 200],
];

function responseRecorder() {
  return {
    headers: {}, statusCode: null, body: null,
    setHeader(name, value) { this.headers[name] = value; },
    status(value) { this.statusCode = value; return this; },
    json(value) { this.body = value; return this; },
    send(value) { this.body = value; return this; },
  };
}

async function runRoute(route, { cookie, authStatus = 200, refreshStatus = 200, operationStatus } = {}) {
  const requests = [];
  const operations = [];
  const fetchImpl = async (url, options) => {
    requests.push({ url, options });
    if (url.endsWith('/auth/v1/user')) {
      const status = options.headers.Authorization === 'Bearer expired-access' ? 401 : authStatus;
      return { ok: status === 200, status, json: async () => status === 200 ? user : { message: 'private upstream detail' } };
    }
    assert.equal(url, `${config.url}/auth/v1/token?grant_type=refresh_token`);
    assert.deepEqual(JSON.parse(options.body), { refresh_token: 'valid-refresh' });
    return { ok: refreshStatus === 200, status: refreshStatus, json: async () => refreshStatus === 200 ? {
      access_token: 'renewed-access', refresh_token: 'renewed-refresh', expires_in: 3600, user,
    } : { message: 'private upstream detail' } };
  };
  const authService = {
    ...auth, getAuthConfig: () => config,
    getAuthenticatedUser: (args) => auth.getAuthenticatedUser({ ...args, fetchImpl }),
    refreshAuthSession: (args) => auth.refreshAuthSession({ ...args, fetchImpl }),
  };
  const [, modulePath, factoryName, operationName, method] = route;
  const handler = require(modulePath)[factoryName]({
    authService, randomUUID: () => '30000000-0000-4000-8000-000000000001',
    [operationName]: async (args) => {
      operations.push(args);
      if (operationStatus) throw Object.assign(new Error('Acceso denegado.'), { status: operationStatus });
      return { id: fixture.projectId, revision: 1, mimeType: 'image/png', bytes: Buffer.from('image') };
    },
  });
  const response = responseRecorder();
  await handler({ method, headers: { cookie, 'content-type': 'application/json', 'x-forwarded-proto': 'https' },
    body: { document: fixture, expectedRevision: 0, projectId: fixture.projectId },
    query: { projectId: fixture.projectId },
  }, response);
  return { response, requests, operations };
}

(async () => {
  for (const route of routes) {
    const [name, , , , , successStatus] = route;
    for (const cookie of [
      'invitta_access_token=expired-access; invitta_refresh_token=valid-refresh',
      'invitta_refresh_token=valid-refresh', // Browser removed the expired access cookie.
    ]) {
      const renewed = await runRoute(route, { cookie });
      assert.equal(renewed.response.statusCode, successStatus, `${name}: a renewable session must keep working`);
      assert.equal(renewed.operations.length, 1, `${name}: execute exactly once`);
      assert.equal(renewed.operations[0].accessToken, 'renewed-access', `${name}: RLS must receive the renewed user JWT`);
      if ('userId' in renewed.operations[0]) assert.equal(renewed.operations[0].userId, user.id);
      const cookies = renewed.response.headers['Set-Cookie'];
      assert.equal(cookies.length, 2);
      assert.ok(cookies.every((value) => value.includes('HttpOnly') && value.includes('Secure') && value.includes('SameSite=Lax')));
      assert.ok(cookies[0].includes('renewed-access'));
      assert.ok(cookies[1].includes('renewed-refresh'));
      assert.ok(!JSON.stringify(renewed.response.body).includes('renewed-access'), 'Never put credentials in response JSON');
    }

    const active = await runRoute(route, { cookie: 'invitta_access_token=active-access; invitta_refresh_token=valid-refresh' });
    assert.equal(active.response.statusCode, successStatus);
    assert.equal(active.operations[0].accessToken, 'active-access');
    assert.equal(active.requests.length, 1, 'Do not rotate an active session unnecessarily');
    assert.equal(active.response.headers['Set-Cookie'], undefined);

    const absent = await runRoute(route);
    assert.equal(absent.response.statusCode, 401);
    assert.equal(absent.operations.length, 0);
    assert.equal(absent.requests.length, 0);

    const revoked = await runRoute(route, { cookie: 'invitta_refresh_token=valid-refresh', refreshStatus: 400 });
    assert.equal(revoked.response.statusCode, 401);
    assert.equal(revoked.operations.length, 0);
    assert.ok(revoked.response.headers['Set-Cookie'].every((value) => value.includes('Max-Age=0')));

    for (const options of [
      { cookie: 'invitta_access_token=active-access; invitta_refresh_token=valid-refresh', authStatus: 503 },
      { cookie: 'invitta_refresh_token=valid-refresh', refreshStatus: 503 },
    ]) {
      const unavailable = await runRoute(route, options);
      assert.equal(unavailable.response.statusCode, 502, `${name}: upstream failure is not invalid credentials`);
      assert.equal(unavailable.operations.length, 0);
      assert.equal(unavailable.response.headers['Set-Cookie'], undefined, 'Do not erase a session during an outage');
      assert.equal(unavailable.requests.length, 1, 'Do not retry or refresh after an upstream failure');
      assert.ok(!JSON.stringify(unavailable.response.body).includes('private upstream detail'));
    }

    const forbidden = await runRoute(route, { cookie: 'invitta_refresh_token=valid-refresh', operationStatus: 403 });
    assert.equal(forbidden.response.statusCode, 403, `${name}: renewal must not grant project access`);
    assert.equal(forbidden.operations.length, 1);
  }
  console.log('All project routes renew expired sessions without bypassing permissions or clearing cookies on outages.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
