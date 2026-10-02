'use strict';
// Runs only inside the existing fixture harness, whose project/link/ports are checked.
const assert = require('node:assert/strict');
const http = require('node:http');
const { readFile } = require('node:fs/promises');
const { resolve, extname } = require('node:path');
const { randomUUID } = require('node:crypto');
const { main } = require('./test-project-operations-local.cjs');
const authService = require('../lib/supabase-auth-service.cjs');
const store = require('../lib/project-operations-store.cjs');
const { createProjectOperationsHandler } = require('../lib/project-operations-handler.cjs');

async function verifyConsumer({ users, projects, request, env }) {
  const config = { url: env.API_URL, publishableKey: env.ANON_KEY };
  const services = { ...authService, getAuthConfig: () => config };
  const handlers = Object.fromEntries(['guests', 'tables'].map(resource => [resource,
    createProjectOperationsHandler({ resource, authService: services, operate: store.operate })]));
  const browserMode = process.argv.includes('--browser');
  const staticFiles = new Set(['organizador-mesas.html', 'role-manager.js', 'event-vault-manager.js', 'guest-manager.js',
    'seating-module/seating-planner.js', 'src/project-organizer-client.js', 'src/project-organizer.js', 'css/project-organizer.css', 'css/main.css', 'theme.css']);
  let browserProject, failNextWrite = false;
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    if (browserMode && browserProject && url.pathname.startsWith('/__fixture/')) {
      const role = url.pathname.split('/').at(-1);
      const user = users.find(u => u.role === role);
      if (user) {
        res.setHeader('Set-Cookie', authService.buildSessionCookies({ accessToken: user.token, refreshToken: '', expiresIn: 3600 }, { secure: false }));
      } else if (role === 'fail-save') failNextWrite = true;
      else { res.writeHead(404); res.end(); return; }
      res.writeHead(302, { Location: `/organizador-mesas.html?project=${browserProject}` }); res.end(); return;
    }
    if (browserMode && staticFiles.has(url.pathname.slice(1))) {
      try {
        const data = await readFile(resolve(__dirname, '..', url.pathname.slice(1)));
        const type = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' }[extname(url.pathname)];
        res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' }); res.end(data);
      } catch (_) { res.writeHead(404); res.end(); } return;
    }
    const resource = url.pathname.match(/^\/api\/projects\/(guests|tables)$/)?.[1];
    if (!resource) { res.writeHead(404); res.end(); return; }
    req.query = Object.fromEntries(url.searchParams);
    let body = ''; for await (const chunk of req) { body += chunk; if (body.length > 8192) break; }
    req.body = body;
    res.status = code => { res.statusCode = code; return res; };
    res.json = value => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(value)); };
    if (failNextWrite && ['POST', 'PATCH'].includes(req.method)) {
      failNextWrite = false; res.status(502).json({ success: false, code: 'STORE_UNAVAILABLE', error: 'Fallo sintético local: verifica antes de reintentar.' }); return;
    }
    await handlers[resource](req, res);
  });
  await new Promise(resolve => server.listen(browserMode ? 8099 : 0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const [owner, planner, designer, , , , outsider] = users;
  const [a, b] = projects;
  await request('/rest/v1/invitation_project_members', owner.token, 'POST', { project_id: a, user_id: planner.id, role: 'planner' });
  let checks = 0;
  async function api(resource, user, method = 'GET', input = { projectId: a }, expected = 200) {
    const url = new URL(`/api/projects/${resource}`, origin);
    if (method === 'GET') for (const [key, value] of Object.entries(input)) url.searchParams.set(key, value);
    const response = await fetch(url, { method, headers: { Origin: origin, 'Content-Type': 'application/json',
      ...(user ? { Cookie: `${authService.ACCESS_COOKIE}=${user.token}` } : {}) },
      ...(method !== 'GET' ? { body: JSON.stringify(input) } : {}) });
    const payload = await response.json();
    assert.equal(response.status, expected, `${method} ${resource}: expected ${expected}, got ${response.status}/${payload.code}`);
    assert.equal(payload.success, expected < 400); checks++;
    return payload;
  }
  try {
    for (const resource of ['tables', 'guests']) {
      await api(resource, null, 'GET', { projectId: a }, 401);
      await api(resource, designer, 'GET', { projectId: a }, 403);
      await api(resource, outsider, 'GET', { projectId: a }, 404);
      await api(resource, planner, 'GET', { projectId: b }, 404);
    }
    const tableId = randomUUID(), guestId = randomUUID();
    const table = { projectId: a, id: tableId, name: 'HTTP table', type: 'circular', capacity: 8 };
    assert.equal((await api('tables', planner, 'POST', table, 201)).record.version, 1);
    const guest = { projectId: a, id: guestId, name: 'HTTP family', passes: 2, tableId };
    await api('guests', owner, 'POST', guest, 201);
    await api('guests', owner, 'POST', guest, 409);
    await api('guests', planner, 'PATCH', { projectId: a, id: guestId, expectedVersion: 1, tableId: null });
    const all = await api('guests', planner);
    assert.equal(all.records.find(g => g.id === guestId).tableId, null); checks++;
    const results = await Promise.all([owner, planner].map(user => api('guests', user, 'PATCH',
      { projectId: a, id: guestId, expectedVersion: 2, name: user === owner ? 'Owner HTTP edit' : 'Planner HTTP edit' }, 200).catch(error => error)));
    // Inspect both statuses without assuming which connection obtains the row lock.
    assert.equal(results.filter(r => r.success === true).length, 1);
    assert.equal(results.filter(r => r instanceof assert.AssertionError && r.actual === 409).length, 1); checks++;
    assert.equal((await api('guests', owner)).records.find(g => g.id === guestId).version, 3);
    await api('guests', owner, 'PATCH', { projectId: b, id: guestId, expectedVersion: 3, name: 'Wrong project' }, 409);
    const first = await api('guests', owner, 'GET', { projectId: a, limit: 1 });
    assert.equal(first.records.length, 1); assert(first.nextCursor);
    const second = await api('guests', owner, 'GET', { projectId: a, limit: 1, cursor: first.nextCursor });
    assert(second.records.every(r => r.id > first.nextCursor)); checks++;
    await api('tables', owner, 'PATCH', { projectId: a, id: tableId, expectedVersion: 1, capacity: 12 });
    await api('tables', planner, 'PATCH', { projectId: a, id: tableId, expectedVersion: 1, capacity: 10 }, 409);
    await request(`/rest/v1/invitation_project_members?project_id=eq.${a}&user_id=eq.${planner.id}`, owner.token, 'DELETE');
    await api('guests', planner, 'GET', { projectId: a }, 404);
    console.log(`PASS: ${checks} real HTTP handler/Auth/PostgREST consumer checks`);
    if (browserMode) {
      browserProject = randomUUID(); projects.push(browserProject);
      const created = await request('/rest/v1/invitation_projects', owner.token, 'POST', { id: browserProject, owner_user_id: owner.id,
        slug: `browser-${randomUUID()}`, name: 'Synthetic browser project', event_type: 'other' });
      assert.equal(created.status, 201);
      await request('/rest/v1/invitation_project_members', owner.token, 'POST', { project_id: browserProject, user_id: planner.id, role: 'planner' });
      console.log('BROWSER READY: http://localhost:8099/__fixture/owner');
      console.log('SECOND SESSION: http://127.0.0.1:8099/__fixture/planner');
      console.log('Stop with Ctrl+C to clean up exact synthetic fixtures.');
      await new Promise(resolve => { process.once('SIGINT', resolve); process.once('SIGTERM', resolve); });
    }
  } finally { await new Promise(resolve => server.close(resolve)); }
}
if (require.main === module) main({ verifyConsumer }).catch(e => { console.error(e.message); process.exitCode = 1; });
module.exports = { verifyConsumer };
