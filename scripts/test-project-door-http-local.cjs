'use strict';
// This callback can only run after the shared harness validates local test ports,
// disposable project id and absence of a linked project. No remote services.
const assert = require('node:assert/strict');
const http = require('node:http');
const { randomUUID, randomBytes } = require('node:crypto');
const { readFile } = require('node:fs/promises');
const { resolve, extname } = require('node:path');
const { isDeepStrictEqual } = require('node:util');
const { main } = require('./test-project-operations-local.cjs');
const authService = require('../lib/supabase-auth-service.cjs');
const { operatePass } = require('../lib/project-door-store.cjs');
const { createDoorHandler } = require('../lib/project-door-handler.cjs');
const operationsStore = require('../lib/project-operations-store.cjs');
const { createProjectOperationsHandler } = require('../lib/project-operations-handler.cjs');

const publicKeys = ['name', 'passes', 'admitted', 'remaining', 'expiresAt', 'revoked', 'projectName', 'tableName'].sort();
const passKeys = [...publicKeys, 'ticketId', 'guestId', 'projectId'].sort();
const admissionKeys = ['operationId', 'ticketId', 'count', 'admitted', 'remaining', 'confirmedAt'].sort();
const staticFiles = new Set(['puerta-proyecto.html', 'pase.html', 'css/project-door.css',
  'src/project-door-client.js', 'src/project-door-camera.js', 'src/project-door.js', 'src/public-pass.js']);
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

async function verifyConsumer({ users, projects, request, env }) {
  const [owner, planner, designer, hostess, catering, viewer, outsider] = users;
  const [a, b] = projects;
  const secret = randomBytes(32).toString('hex');
  const services = { ...authService, getAuthConfig: () => ({ url: env.API_URL, publishableKey: env.ANON_KEY }) };
  // Bind a synthetic signer to this server instance; never mutate process.env.
  const operate = args => operatePass({ ...args, secret });
  const privateHandler = createDoorHandler({ authService: services, operate });
  const publicHandler = createDoorHandler({ authService: services, operate, publicRead: true });
  const tablesHandler = createProjectOperationsHandler({ authService: services, resource: 'tables', operate: operationsStore.operate });
  const browserMode = process.argv.includes('--browser');
  let browserProject = null, lastIssued = null, failAfterCommit = false, checks = 0;
  function check(condition, label) { assert(condition, label); checks++; }
  // Use boolean comparisons for signed results so assertion diagnostics cannot
  // print the synthetic bearer credential, cookies or signer key.
  function same(actual, expected, label) { check(isDeepStrictEqual(actual, expected), label); }
  async function rows(path, user, method = 'GET', body) {
    const result = await request(`/rest/v1/${path}`, user.token, method, body);
    check(result.status >= 200 && result.status < 300, `Fixture ${method} ${path.split('?')[0]}: HTTP ${result.status} / ${result.data?.code || 'none'}`);
    return result.data;
  }
  await rows('invitation_project_members', owner, 'POST', { project_id: a, user_id: planner.id, role: 'planner' });
  const [table] = await rows('invitation_tables', owner, 'POST', { project_id: a, name: 'HTTP synthetic door table', type: 'circular', capacity: 20 });

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://127.0.0.1');
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Referrer-Policy', 'no-referrer');
      if (browserMode && browserProject && req.method === 'GET' && url.pathname.startsWith('/__fixture/')) {
        const fixture = url.pathname.slice('/__fixture/'.length);
        const user = ['owner', 'planner', 'hostess'].includes(fixture) && users.find(item => item.role === fixture);
        if (user) {
          res.setHeader('Set-Cookie', authService.buildSessionCookies({ accessToken: user.token, refreshToken: '', expiresIn: 3600 }, { secure: false }));
          res.writeHead(302, { Location: `/puerta-proyecto.html?project=${browserProject}` }); res.end(); return;
        }
        if (fixture === 'fail-after-commit') {
          failAfterCommit = true;
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(`<html lang="es"><title>Fallo sintético armado</title><p>La próxima emisión o admisión confirmada devolverá un resultado sin confirmar. Conserva la misma solicitud para reintentar.</p><a href="/puerta-proyecto.html?project=${browserProject}">Volver a puerta</a></html>`); return;
        }
        if (fixture === 'last-boleto') {
          res.writeHead(lastIssued ? 200 : 404, { 'Content-Type': 'text/html; charset=utf-8' });
          // Only the bearer from this fresh synthetic browser project is visible,
          // through this explicit QA fixture. No Auth token or signer is exposed.
          res.end(lastIssued ? `<html lang="es"><title>Boleto sintético</title><p>${escapeHtml(lastIssued.name)}</p><label>Código sintético para otra sesión<textarea readonly>${escapeHtml(lastIssued.credential)}</textarea></label><p><a href="/pase.html#${escapeHtml(lastIssued.credential)}">Abrir pase sintético</a></p></html>`
            : '<html lang="es"><title>Sin boleto</title><p>Emite primero un boleto en el proyecto sintético.</p></html>'); return;
        }
        res.writeHead(404); res.end(); return;
      }
      if (browserMode && req.method === 'GET' && staticFiles.has(url.pathname.slice(1))) {
        const data = await readFile(resolve(__dirname, '..', url.pathname.slice(1)));
        const type = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' }[extname(url.pathname)];
        res.writeHead(200, { 'Content-Type': type }); res.end(data); return;
      }
      const handler = url.pathname === '/api/projects/passes' ? privateHandler
        : url.pathname === '/api/public/pass' ? publicHandler
          : url.pathname === '/api/projects/tables' ? tablesHandler : null;
      if (!handler) { res.writeHead(404); res.end(); return; }
      req.query = Object.fromEntries(url.searchParams);
      const chunks = []; let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 8192) { res.writeHead(422, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: false, code: 'INVALID_INPUT', error: 'Solicitud inválida.' })); return; }
        chunks.push(chunk);
      }
      req.body = chunks.length ? Buffer.concat(chunks).toString('utf8') : undefined;
      let input; try { input = JSON.parse(req.body || '{}'); } catch (_) { input = {}; }
      const injectFailure = failAfterCommit && handler === privateHandler && ['issue', 'admit'].includes(input.action);
      if (injectFailure) failAfterCommit = false;
      res.status = code => { res.statusCode = code; return res; };
      res.json = value => {
        if (browserProject && input.projectId === browserProject && input.action === 'issue' && value.success && value.credential) {
          lastIssued = { name: value.pass.name, credential: value.credential };
        }
        res.setHeader('Content-Type', 'application/json');
        if (injectFailure && value.success === true) {
          // Execute the real handler/transaction, then lose its successful
          // response. This models uncertainty after commit, not a DB fake.
          res.statusCode = 502;
          res.end(JSON.stringify({ success: false, code: 'STORE_UNAVAILABLE', error: 'Fallo sintético después del commit. Conserva y verifica la misma solicitud.' }));
        } else res.end(JSON.stringify(value));
      };
      await handler(req, res);
    } catch (_) {
      if (!res.headersSent) res.writeHead(502, { 'Content-Type': 'application/json' });
      if (!res.writableEnded) res.end(JSON.stringify({ success: false, code: 'STORE_UNAVAILABLE', error: 'Fallo del servidor local de pruebas.' }));
    }
  });
  await new Promise((done, reject) => {
    server.once('error', reject);
    server.listen(browserMode ? 8100 : 0, '127.0.0.1', done);
  });
  const origin = `http://127.0.0.1:${server.address().port}`;
  async function api(input, user = owner, expected = 200, { publicRead = false, originHeader = origin, method = 'POST' } = {}) {
    const response = await fetch(`${origin}${publicRead ? '/api/public/pass' : '/api/projects/passes'}`, {
      method, redirect: 'error', signal: AbortSignal.timeout(20000),
      headers: { 'Content-Type': 'application/json', ...(originHeader === null ? {} : { Origin: originHeader }),
        ...(user && !publicRead ? { Cookie: `${authService.ACCESS_COOKIE}=${user.token}` } : {}) },
      ...(method === 'GET' ? {} : { body: JSON.stringify(input) })
    });
    const data = await response.json();
    check(response.status === expected, `HTTP ${publicRead ? 'public' : input?.action || 'private'} expected ${expected}, got ${response.status}/${data?.code || 'none'}`);
    check(data.success === (expected < 400), 'HTTP success flag matches confirmed status');
    check(response.headers.get('cache-control') === 'no-store', 'Private/bearer results are never cached');
    return data;
  }
  const issuance = (overrides = {}) => ({ action: 'issue', projectId: a, operationId: randomUUID(), name: `HTTP synthetic ${randomUUID()}`,
    passes: 4, tableId: table.id, immediate: false, ...overrides });
  try {
    for (const user of [owner, planner, hostess]) {
      const context = await api({ action: 'context', projectId: a }, user);
      same(Object.keys(context).sort(), ['context', 'success'], 'Context response has strict contracted shape');
      same(context.context, { projectName: 'Local a', canIssue: user !== hostess, canAdmit: true }, 'Context reflects explicit project permissions');
    }
    await api({ action: 'context', projectId: a }, null, 401);
    for (const user of [designer, catering, viewer, outsider]) await api({ action: 'context', projectId: a }, user, 403);
    await api(issuance(), null, 401);
    await api(issuance(), hostess, 403);
    await api(issuance({ projectId: b }), planner, 403);
    await api(issuance(), owner, 403, { originHeader: null });
    await api(issuance(), owner, 403, { originHeader: 'https://foreign.invalid' });
    await api({}, owner, 405, { method: 'GET' });

    const input = issuance();
    const issued = await api(input, owner, 201);
    same(Object.keys(issued).sort(), ['credential', 'pass', 'success'], 'Issue HTTP response has strict shape');
    same(Object.keys(issued.pass).sort(), passKeys, 'Issue returns exact private pass fields');
    check(typeof issued.credential === 'string' && issued.credential.startsWith(`IV2.${a}.${input.operationId}.`), 'Real handler issues a server-signed credential');
    same([issued.pass.name, issued.pass.passes, issued.pass.admitted, issued.pass.remaining, issued.pass.tableName],
      [input.name, 4, 0, 4, table.name], 'HTTP issuer confirms guest and initial balance');
    same(await api(input, owner, 201), issued, 'HTTP retry recovers original issuance including credential');
    const read = await api({ credential: issued.credential }, null, 200, { publicRead: true });
    same(Object.keys(read).sort(), ['pass', 'success'], 'Public HTTP response exposes only pass');
    same(Object.keys(read.pass).sort(), publicKeys, 'Public HTTP pass omits identities and logs');
    same(read.pass, Object.fromEntries(publicKeys.map(key => [key, issued.pass[key]])), 'Public HTTP read matches this bearer');
    const inspect = { action: 'inspect', projectId: a, credential: issued.credential };
    same((await api(inspect, hostess)).pass, issued.pass, 'Independent hostess session recognizes owner credential');
    const altered = issued.credential.slice(0, -1) + (issued.credential.endsWith('A') ? 'B' : 'A');
    await api({ ...inspect, credential: altered }, hostess, 422);
    await api({ ...inspect, credential: JSON.stringify({ name: input.name, passes: 99 }) }, hostess, 422);
    await api({ credential: altered }, null, 422, { publicRead: true });
    await api({ ...inspect, projectId: b }, owner, 422);
    await api({ credential: issued.credential, projectId: a }, null, 422, { publicRead: true });
    for (const user of [designer, catering, viewer, outsider]) {
      await api(inspect, user, 403);
      await api({ action: 'admit', projectId: a, credential: issued.credential, operationId: randomUUID(), count: 1 }, user, 403);
    }
    const admissionInput = { action: 'admit', projectId: a, credential: issued.credential, operationId: randomUUID(), count: 2 };
    const admitted = await api(admissionInput, hostess);
    same(Object.keys(admitted).sort(), ['admission', 'success'], 'Admission HTTP response has exact outer fields');
    same(Object.keys(admitted.admission).sort(), admissionKeys, 'Admission HTTP response has exact result fields');
    same([admitted.admission.count, admitted.admission.admitted, admitted.admission.remaining], [2, 2, 2], 'Hostess records first partial group');
    same(await api(admissionInput, hostess), admitted, 'HTTP double click counts once');
    await api({ ...admissionInput, count: 1 }, hostess, 409);
    const second = await api({ ...admissionInput, operationId: randomUUID() }, planner);
    same([second.admission.admitted, second.admission.remaining], [4, 0], 'Second authorized session completes the family');
    same(await api(admissionInput, hostess), admitted, 'HTTP old retry preserves original partial result');
    await api({ ...admissionInput, operationId: randomUUID(), count: 1 }, hostess, 409);

    const uncertainInput = issuance({ passes: 3, immediate: true });
    failAfterCommit = true;
    await api(uncertainInput, owner, 502);
    const recoveredIssue = await api(uncertainInput, owner, 201);
    same([recoveredIssue.pass.admitted, recoveredIssue.pass.remaining], [3, 0], 'Unknown issuance outcome recovers one immediate admission');
    same((await rows(`invitation_guests?project_id=eq.${a}&name=eq.${encodeURIComponent(uncertainInput.name)}`, owner)).length, 1, 'Unknown issuance outcome creates one guest');
    const uncertainAdmissionPass = await api(issuance({ passes: 3 }), owner, 201);
    const uncertainAdmission = { action: 'admit', projectId: a, credential: uncertainAdmissionPass.credential, operationId: randomUUID(), count: 2 };
    failAfterCommit = true;
    await api(uncertainAdmission, hostess, 502);
    const recoveredAdmission = await api(uncertainAdmission, hostess);
    same([recoveredAdmission.admission.admitted, recoveredAdmission.admission.remaining], [2, 1], 'Unknown admission outcome recovers committed count once');
    same(await api(uncertainAdmission, hostess), recoveredAdmission, 'Recovered admission result remains stable');

    const revoked = await api({ action: 'revoke', projectId: a, credential: issued.credential }, owner);
    same(revoked, { success: true, revocation: { ticketId: input.operationId, revoked: true } }, 'Owner HTTP revocation returns only contracted result');
    await api({ credential: issued.credential }, null, 404, { publicRead: true });
    await api(inspect, hostess, 404);
    await api({ ...admissionInput, operationId: randomUUID(), count: 1 }, hostess, 404);
    same(await api(admissionInput, hostess), admitted, 'Revocation preserves committed admission recovery');
    console.log(`PASS: ${checks} real local HTTP/Auth/PostgREST door checks`);

    if (browserMode) {
      browserProject = randomUUID(); projects.push(browserProject);
      await rows('invitation_projects', owner, 'POST', { id: browserProject, owner_user_id: owner.id,
        slug: `door-browser-${randomUUID()}`, name: 'Proyecto sintético de puerta', event_type: 'other' });
      for (const user of [planner, hostess]) await rows('invitation_project_members', owner, 'POST',
        { project_id: browserProject, user_id: user.id, role: user.role });
      await rows('invitation_tables', owner, 'POST', { project_id: browserProject, name: 'Mesa sintética de puerta', type: 'circular', capacity: 20 });
      console.log('BROWSER READY: http://localhost:8100/__fixture/owner');
      console.log('SECOND SESSION: http://127.0.0.1:8100/__fixture/hostess');
      console.log('SYNTHETIC LAST PASS: http://127.0.0.1:8100/__fixture/last-boleto');
      console.log('UNKNOWN OUTCOME FIXTURE: http://localhost:8100/__fixture/fail-after-commit');
      console.log('Stop with Ctrl+C to close server and remove exact synthetic fixtures.');
      await new Promise(done => { process.once('SIGINT', done); process.once('SIGTERM', done); });
    }
  } finally {
    await new Promise(done => server.close(done));
  }
}

module.exports = { verifyConsumer };
if (require.main === module) main({ verifyConsumer }).catch(error => { console.error(error.message); process.exitCode = 1; });
