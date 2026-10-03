'use strict';
const assert = require('node:assert/strict');
const { ProjectOrganizerClient } = require('./src/project-organizer-client.js');
const projectId = '10000000-0000-4000-8000-000000000001', id = '20000000-0000-4000-8000-000000000001';
const row = { id, projectId, name: 'Family', passes: 2, tableId: null, version: 1, createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z' };
const response = (payload, status = 200) => ({ ok: status < 400, status, json: async () => payload });
const list = records => response({ success: true, records, nextCursor: null });
(async () => {
  let writes = 0, persisted = [], failWrite = true;
  const client = new ProjectOrganizerClient(projectId, async (url, options) => {
    assert.equal(options.credentials, 'same-origin');
    if (options.method !== 'GET') { writes++; persisted = [row]; if (failWrite) throw new Error('lost response'); return response({ success: true, record: row }); }
    return list(url.includes('guests') ? persisted : []);
  });
  await client.load(); assert.equal(client.status, 'ready'); assert.deepEqual(client.guests, []);
  const intent = { id, name: 'Family', passes: 2, tableId: null };
  await assert.rejects(client.save('guests', intent), e => e.code === 'UNKNOWN_RESULT');
  assert.equal(client.status, 'unknown'); assert.equal(client.guests.length, 0);
  assert.equal(client.pending.id, id);
  assert.equal((await client.reconcile()).id, id); assert.equal(writes, 1);
  assert.equal(client.guests.length, 1); assert.equal(client.pending, null);
  const conflict = new ProjectOrganizerClient(projectId, async (url, options) => options.method === 'GET' ? list(url.includes('guests') ? [row] : []) : response({ success: false, code: 'CONFLICT', error: 'stale' }, 409));
  await conflict.load();
  await assert.rejects(conflict.save('guests', { ...intent, name: 'Local edit', expectedVersion: 1 }), e => e.code === 'CONFLICT');
  assert.equal(conflict.guests[0].name, 'Family');
  const readResolvers = [];
  const stale = new ProjectOrganizerClient(projectId, async (url, options) => options.method === 'GET'
    ? new Promise(resolve => { readResolvers.push(resolve); }) : response({ success: true, record: row }));
  const loading = stale.load();
  await stale.save('guests', intent); readResolvers.forEach(resolve => resolve(list([]))); await loading;
  assert.equal(stale.guests.length, 1, 'old load cannot replace confirmed save');
  const malformed = new ProjectOrganizerClient(projectId, async () => list([{ ...row, projectId: id }]));
  await assert.rejects(malformed.load()); assert.equal(malformed.status, 'error');
  const denied = new ProjectOrganizerClient(projectId, async () => response({ success: false, code: 'FORBIDDEN', error: 'denied' }, 403));
  await assert.rejects(denied.load()); assert.equal(denied.status, 'error');
  let finishWrite;
  const busy = new ProjectOrganizerClient(projectId, async () => new Promise(resolve => { finishWrite = resolve; }));
  const first = busy.save('guests', intent);
  await assert.rejects(busy.save('guests', intent), e => e.code === 'BUSY');
  finishWrite(response({ success: true, record: row })); await first;
  const pagination = new ProjectOrganizerClient(projectId, async url => {
    if (url.includes('tables')) return list([]);
    return url.includes('cursor=') ? list([]) : response({ success: true, records: [row], nextCursor: id });
  });
  await pagination.load(); assert.equal(pagination.guests.length, 1);
  const unchanged = new ProjectOrganizerClient(projectId, async (url, options) => options.method === 'GET' ? list([]) : response({ success: true, record: {} }));
  await assert.rejects(unchanged.save('guests', intent), e => e.code === 'UNKNOWN_RESULT');
  assert.equal(await unchanged.reconcile(), null); assert.equal(unchanged.pending, null);
  console.log('Organizer client persistence, unknown results, conflicts and stale reads passed.');
})().catch(e => { console.error(e); process.exitCode = 1; });
