const assert = require('node:assert/strict');
const http = require('node:http');
const auth = require('./lib/supabase-auth-service.cjs');
const { createProjectRevisionHandler } = require('./lib/project-revision-handler.cjs');
const { saveRevisionWithUserToken } = require('./lib/supabase-project-revisions.cjs');
const fixture = require('./fixtures/invitation-document.v1.json');

function listen(server) {
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${server.address().port}`)));
}
function close(server) { return new Promise((resolve) => server.close(resolve)); }
function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}
async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString() || '{}');
}

(async () => {
  const documents = [];
  const dataTokens = [];
  let refreshes = 0;
  const user = { id: '10000000-0000-4000-8000-000000000001', email: 'owner@example.test' };
  const upstream = http.createServer(async (req, res) => {
    if (req.url === '/auth/v1/user') {
      return json(res, req.headers.authorization === 'Bearer renewed-access' ? 200 : 401, user);
    }
    if (req.url === '/auth/v1/token?grant_type=refresh_token') {
      assert.equal((await readBody(req)).refresh_token, 'valid-refresh');
      refreshes++;
      return json(res, 200, { access_token: 'renewed-access', refresh_token: 'rotated-refresh', expires_in: 3600, user });
    }
    assert.ok(req.url.startsWith('/rest/v1/invitation_documents?'));
    dataTokens.push(req.headers.authorization);
    if (req.method === 'GET') return json(res, 200, documents.slice(-1));
    const document = await readBody(req);
    assert.equal(document.created_by, user.id);
    documents.push({ ...document, id: `document-${document.revision}` });
    return json(res, 201, [documents.at(-1)]);
  });
  let api;
  try {
    const upstreamUrl = await listen(upstream);
    const handler = createProjectRevisionHandler({
      authService: { ...auth, getAuthConfig: () => ({ url: upstreamUrl, publishableKey: 'local-test' }) },
      saveRevision: saveRevisionWithUserToken,
    });
    api = http.createServer(async (req, res) => {
      req.body = await readBody(req);
      res.status = (status) => { res.statusCode = status; return res; };
      res.json = (body) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(body)); };
      await handler(req, res);
    });
    const apiUrl = await listen(api);
    const first = await fetch(apiUrl, {
      method: 'POST', headers: { 'Content-Type': 'application/json',
        cookie: 'invitta_access_token=expired-access; invitta_refresh_token=valid-refresh',
        'x-forwarded-proto': 'https' },
      body: JSON.stringify({ document: fixture, expectedRevision: 0 }),
    });
    assert.equal(first.status, 201);
    assert.equal((await first.json()).revision.revision, 1);
    assert.match(first.headers.get('set-cookie'), /invitta_access_token=renewed-access/);
    assert.match(first.headers.get('set-cookie'), /invitta_refresh_token=rotated-refresh/);

    const second = await fetch(apiUrl, {
      method: 'POST', headers: { 'Content-Type': 'application/json',
        cookie: 'invitta_access_token=renewed-access; invitta_refresh_token=rotated-refresh' },
      body: JSON.stringify({ document: { ...fixture, revision: 2 }, expectedRevision: 1 }),
    });
    assert.equal(second.status, 201);
    assert.equal((await second.json()).revision.revision, 2);
    assert.equal(second.headers.get('set-cookie'), null);
    assert.equal(documents.length, 2);
    assert.equal(refreshes, 1, 'The next save must use the rotated access cookie without refreshing again');
    assert.ok(dataTokens.every((token) => token === 'Bearer renewed-access'));
    console.log('HTTP integration: expired session rotates cookies, saves a revision, and supports the next save.');
  } finally {
    if (api) await close(api);
    await close(upstream);
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
