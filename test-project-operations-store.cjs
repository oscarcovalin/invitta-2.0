'use strict';
const assert = require('node:assert/strict');
const store = require('./lib/project-operations-store.cjs');
const projectId = '10000000-0000-4000-8000-000000000001';
const id = '20000000-0000-4000-8000-000000000001';
const base = { projectId, id, name: '  Familia Uno  ', passes: 2 };
assert.deepEqual(store.validateInput('guests', 'POST', base), { projectId, id, name: 'Familia Uno', passes: 2, tableId: null });
for (const value of [null, [], {}, { ...base, projectId: 'x' }, { ...base, id: 'x' }, { ...base, name: '' },
  { ...base, name: 'x'.repeat(161) }, { ...base, passes: '2' }, { ...base, passes: 0 },
  { ...base, passes: 101 }, { ...base, role: 'planner' }, { ...base, tableId: 'x' }]) {
  assert.throws(() => store.validateInput('guests', 'POST', value), e => e.status === 422);
}
assert.deepEqual(store.validateInput('guests', 'PATCH', { projectId, id, expectedVersion: 1, tableId: null }),
  { projectId, id, expectedVersion: 1, tableId: null });
for (const extra of [{}, { name: 'x', expectedVersion: 0 }, { name: 'x', version: 2 }, { createdAt: 'x' }]) {
  assert.throws(() => store.validateInput('guests', 'PATCH', { projectId, id, expectedVersion: 1, ...extra }), e => e.status === 422);
}
const table = { projectId, id, name: 'Mesa 1', type: 'circular', capacity: 8 };
assert.deepEqual(store.validateInput('tables', 'POST', table), table);
assert.throws(() => store.validateInput('tables', 'POST', { ...table, type: 'vip' }), e => e.status === 422);
assert.throws(() => store.validateInput('tables', 'POST', { ...table, capacity: 1.5 }), e => e.status === 422);
assert.deepEqual(store.validateInput('tables', 'GET', { projectId }), { projectId, limit: 100 });
assert.deepEqual(store.validateInput('tables', 'GET', { projectId, limit: '1', cursor: id }), { projectId, limit: 1, cursor: id });
for (const input of [{ projectId, limit: '101' }, { projectId, cursor: 'x' }, { projectId, limit: ['1'] }, { projectId, role: 'owner' }]) {
  assert.throws(() => store.validateInput('tables', 'GET', input), e => e.status === 422);
}
console.log('Project operation input boundaries passed.');

const config = { url: 'https://test.supabase.invalid', publishableKey: 'test-key' };
const userId = '30000000-0000-4000-8000-000000000001';
const row = { id, project_id: projectId, name: 'Familia Uno', passes: 2, table_id: null,
  version: 1, created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z' };
const response = (body, status = 200) => ({ ok: status < 400, status, json: async () => body });
function boundary({ owner = userId, role = 'planner', records = [row], status = 200 } = {}) {
  const requests = [];
  return { requests, fetchImpl: async (url, options) => {
    requests.push({ url: new URL(url), options });
    assert.equal(options.headers.Authorization, 'Bearer verified-test-jwt');
    assert.equal(options.headers.apikey, 'test-key');
    const path = new URL(url).pathname;
    if (path.endsWith('/invitation_projects')) return response(owner === null ? [] : [{ id: projectId, owner_user_id: owner }]);
    if (path.endsWith('/invitation_project_members')) return response(role === null ? [] : [{ role }]);
    return response(records, status);
  } };
}
(async () => {
  const run = (method, input, fake) => store.operate({ resource: 'guests', method, input,
    accessToken: 'verified-test-jwt', userId, config, fetchImpl: fake.fetchImpl });
  let fake = boundary();
  const listed = await run('GET', { projectId, limit: '1' }, fake);
  assert.equal(listed.records[0].projectId, projectId);
  assert.equal(listed.records[0].tableId, null);
  assert.equal(listed.nextCursor, id);
  assert.equal(fake.requests.at(-1).url.searchParams.get('project_id'), `eq.${projectId}`);
  assert.equal(fake.requests.at(-1).url.searchParams.get('select'), 'id,project_id,name,passes,table_id,version,created_at,updated_at');
  fake = boundary({ owner: id });
  await run('POST', base, fake);
  assert.deepEqual(JSON.parse(fake.requests.at(-1).options.body), { id, project_id: projectId, name: 'Familia Uno', passes: 2, table_id: null });
  assert.equal(fake.requests.at(-1).options.headers.Prefer, 'return=representation');
  fake = boundary({ records: [{ ...row, version: 2 }] });
  assert.equal((await run('PATCH', { projectId, id, expectedVersion: 1, name: 'Familia Dos' }, fake)).record.version, 2);
  assert.equal(fake.requests.at(-1).url.searchParams.get('version'), 'eq.1');
  assert.equal(fake.requests.at(-1).url.searchParams.get('id'), `eq.${id}`);
  assert.deepEqual(JSON.parse(fake.requests.at(-1).options.body), { name: 'Familia Dos' });
  for (const role of ['designer', 'hostess', 'catering', 'viewer', null]) {
    fake = boundary({ owner: id, role });
    await assert.rejects(run('GET', { projectId }, fake), e => e.status === 403);
    assert.equal(fake.requests.length, 2);
  }
  await assert.rejects(run('GET', { projectId }, boundary({ owner: null })), e => e.status === 404);
  for (const role of [{}, 7, 'unexpected']) {
    await assert.rejects(run('GET', { projectId }, boundary({ owner: id, role })), e => e.status === 502);
  }
  await assert.rejects(store.operate({ resource: 'guests', method: 'GET', input: { projectId }, userId: 'malformed', accessToken: 'verified-test-jwt', config }), e => e.status === 502);
  await assert.rejects(run('PATCH', { projectId, id, expectedVersion: 1, passes: 3 }, boundary({ records: [] })), e => e.status === 409);
  for (const records of [null, {}, [{ ...row, project_id: id }], [{ ...row, passes: '2' }], [{ ...row, version: 0 }]]) {
    await assert.rejects(run('GET', { projectId }, boundary({ records })), e => e.status === 502);
  }
  for (const [status, code, expected] of [[401, '', 401], [403, '42501', 403], [409, '23505', 409], [409, '23503', 422], [400, '23514', 422], [503, '', 502]]) {
    await assert.rejects(run('POST', base, boundary({ status, records: { code, message: 'private upstream detail' } })), e => e.status === expected && !e.message.includes('upstream'));
  }
  await assert.rejects(run('GET', { projectId }, { fetchImpl: async () => { throw new Error('private detail'); } }), e => e.status === 502);
  await assert.rejects(store.operate({ resource: 'guests', method: 'GET', input: { projectId }, userId, accessToken: 'x', config: {} }), e => e.status === 503);
  console.log('Project operation permissions, pagination, writes and failures passed.');
})().catch(e => { console.error(e); process.exitCode = 1; });
