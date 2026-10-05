// Real Auth/PostgREST integration, restricted to the disposable local project.
'use strict';
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { readFileSync, existsSync } = require('node:fs');
const { resolve, join } = require('node:path');
const { spawnSync } = require('node:child_process');

function removedProject(result, id) {
  return result.status >= 200 && result.status < 300 && Array.isArray(result.data)
    && result.data.length === 1 && result.data[0]?.id === id;
}
function removedUser(result, verification) {
  // GoTrue DELETE returns {}; verify absence with GET of the exact fixture UUID.
  return result.status >= 200 && result.status < 300 && verification?.status === 404;
}

async function main({ verifyConsumer } = {}) {
  const workdir = resolve(process.argv[2] || '');
  const cli = process.argv[3];
  assert(cli && process.argv[2], 'Usage: node scripts/test-project-operations-local.cjs <disposable-workdir> <supabase-cli>');
  const config = readFileSync(join(workdir, 'supabase', 'config.toml'), 'utf8');
  assert.match(config, /^project_id = "invitta-project-ops-test"$/m, 'Disposable project required');
  assert(!existsSync(join(workdir, 'supabase', '.temp', 'project-ref')), 'Linked project forbidden');
  const status = spawnSync(cli, ['status', '-o', 'json', '--workdir', workdir], { encoding: 'utf8', timeout: 30000 });
  assert.equal(status.status, 0, 'Local Supabase must be running');
  // Never emit status stdout/stderr: it contains local credentials.
  const env = JSON.parse(status.stdout);
  const url = new URL(env.API_URL);
  assert(['localhost', '127.0.0.1'].includes(url.hostname) && url.protocol === 'http:' && url.port === '55421', 'Local test API required');
  assert.equal(new URL(env.DB_URL).port, '55422', 'Local test database required');
  assert(env.ANON_KEY && env.SERVICE_ROLE_KEY, 'Local credentials required');
  const users = [];
  const projects = [];
  let checks = 0;
  function check(condition, label) { assert(condition, label); checks++; }
  async function request(path, token = env.ANON_KEY, method = 'GET', body) {
    const response = await fetch(new URL(path, url), {
      method, redirect: 'error', signal: AbortSignal.timeout(15000),
      headers: { apikey: env.ANON_KEY, Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const text = await response.text();
    return { status: response.status, data: text ? JSON.parse(text) : null };
  }
  async function rows(path, token, method, body) {
    const result = await request(`/rest/v1/${path}`, token, method, body);
    assert(result.status >= 200 && result.status < 300, `${method || 'GET'} ${path.split('?')[0]}: HTTP ${result.status}, code ${result.data?.code || 'none'}`);
    return result.data;
  }
  async function denied(path, token, method, body, code) {
    const result = await request(`/rest/v1/${path}`, token, method, body);
    check(result.status >= 400 && result.data?.code === code, `${method} ${path.split('?')[0]} expected ${code}, got HTTP ${result.status} / ${result.data?.code || 'none'}`);
  }
  try {
    const roles = ['owner', 'planner', 'designer', 'hostess', 'catering', 'viewer', 'outsider'];
    for (const role of roles) {
      const email = `ops-${randomUUID()}@invitta.test`;
      const password = `Test-${randomUUID()}!`;
      // Admin key is used only for synthetic local fixture creation/cleanup.
      const created = await request('/auth/v1/admin/users', env.SERVICE_ROLE_KEY, 'POST', { email, password, email_confirm: true });
      assert.equal(created.status, 200, 'Create synthetic local user');
      const user = { id: created.data.id, role };
      users.push(user);
      const login = await request('/auth/v1/token?grant_type=password', env.ANON_KEY, 'POST', { email, password });
      assert.equal(login.status, 200, 'Sign in synthetic local user');
      assert(login.data.access_token, 'Real Auth JWT required');
      user.token = login.data.access_token;
    }
    const [owner, planner] = users;
    for (const letter of ['a', 'b']) {
      const id = randomUUID();
      projects.push(id);
      const created = await rows('invitation_projects', owner.token, 'POST', {
        id, owner_user_id: owner.id, slug: `ops-${letter}-${randomUUID()}`, name: `Local ${letter}`, event_type: 'other'
      });
      check(created.length === 1 && created[0].id === id, 'Owner creates and receives project');
    }
    const [a, b] = projects;
    for (const user of users.slice(1, 6)) {
      await rows('invitation_project_members', owner.token, 'POST', { project_id: a, user_id: user.id, role: user.role });
    }
    for (const resource of ['invitation_tables', 'invitation_guests']) {
      check((await rows(`${resource}?project_id=eq.${a}`, owner.token)).length === 0, 'New project has no demonstration data');
      await denied(resource, env.ANON_KEY, 'GET', undefined, '42501');
    }
    const [tableA] = await rows('invitation_tables', owner.token, 'POST', { project_id: a, name: 'A', type: 'circular', capacity: 8 });
    const [tableB] = await rows('invitation_tables', owner.token, 'POST', { project_id: b, name: 'B', type: 'imperial', capacity: 10 });
    const [guest] = await rows('invitation_guests', owner.token, 'POST', { project_id: a, name: 'Family', passes: 2, table_id: tableA.id });
    check(guest.version === 1 && tableA.version === 1, 'Server initializes versions');
    await denied(`invitation_guests?id=eq.${guest.id}`, owner.token, 'PATCH', { table_id: tableB.id }, '23503');
    await denied(`invitation_guests?id=eq.${guest.id}`, owner.token, 'PATCH', { project_id: b }, '42501');
    await denied('invitation_guests', owner.token, 'POST', { project_id: a, name: 'Bad', passes: 0 }, '23514');
    await denied('invitation_tables', owner.token, 'POST', { project_id: a, name: ' ', type: 'circular', capacity: 1 }, '23514');
    for (const field of ['version', 'created_at', 'updated_at']) {
      const value = field === 'version' ? 99 : new Date().toISOString();
      await denied('invitation_guests', owner.token, 'POST', { project_id: a, name: 'Forged', passes: 1, [field]: value }, '42501');
      await denied(`invitation_tables?id=eq.${tableA.id}`, owner.token, 'PATCH', { [field]: value }, '42501');
    }
    for (const resource of ['invitation_tables', 'invitation_guests']) {
      check((await rows(`${resource}?project_id=eq.${a}`, planner.token)).length === 1, 'Planner reads assigned project');
      check((await rows(`${resource}?project_id=eq.${b}`, planner.token)).length === 0, 'Planner cannot read unassigned project');
      await denied(resource, planner.token, 'POST', resource === 'invitation_guests'
        ? { project_id: b, name: 'Forbidden', passes: 1 }
        : { project_id: b, name: 'Forbidden', type: 'circular', capacity: 1 }, '42501');
      check((await rows(`${resource}?project_id=eq.${b}`, planner.token, 'PATCH', { name: 'Forbidden' })).length === 0, 'Planner cannot edit unassigned project');
      await denied(`${resource}?project_id=eq.${a}`, owner.token, 'DELETE', undefined, '42501');
      for (const user of users.slice(2)) {
        check((await rows(`${resource}?project_id=eq.${a}`, user.token)).length === 0, `${user.role} cannot read operations`);
        check((await rows(`${resource}?project_id=eq.${a}`, user.token, 'PATCH', { name: 'Forbidden' })).length === 0, `${user.role} cannot edit operations`);
        await denied(resource, user.token, 'POST', resource === 'invitation_guests'
          ? { project_id: a, name: 'Forbidden', passes: 1 }
          : { project_id: a, name: 'Forbidden', type: 'circular', capacity: 1 }, '42501');
      }
    }
    const [plannerTable] = await rows('invitation_tables', planner.token, 'POST', { project_id: a, name: 'Planner', type: 'rectangular', capacity: 4 });
    const [plannerGuest] = await rows('invitation_guests', planner.token, 'POST', { project_id: a, name: 'Planner guest', passes: 1, table_id: plannerTable.id });
    check(plannerGuest.table_id === plannerTable.id, 'Planner creates assigned records');
    // PostgreSQL rechecks the WHERE version after waiting on the concurrent row lock.
    const path = `invitation_guests?id=eq.${guest.id}&project_id=eq.${a}&version=eq.1`;
    const competing = await Promise.all([
      rows(path, owner.token, 'PATCH', { name: 'Owner edit' }),
      rows(path, planner.token, 'PATCH', { name: 'Planner edit' })
    ]);
    check(competing.map(result => result.length).sort().join(',') === '0,1', 'One concurrent writer wins; stale writer gets zero rows');
    const winner = competing.find(result => result.length === 1)[0];
    check(winner.version === 2, 'Winning update increments version exactly once');
    const [persisted] = await rows(`invitation_guests?id=eq.${guest.id}`, owner.token);
    check(persisted.name === winner.name && persisted.version === 2, 'Stale write did not overwrite winner');
    check(Date.parse(persisted.updated_at) >= Date.parse(persisted.created_at), 'Timestamp is server-managed');
    const tableWrites = await Promise.all([owner, planner].map(user => rows(
      `invitation_tables?id=eq.${tableA.id}&project_id=eq.${a}&version=eq.1`, user.token, 'PATCH', { capacity: 9 }
    )));
    check(tableWrites.map(result => result.length).sort().join(',') === '0,1', 'Table concurrency has one winner');
    const tableWinner = tableWrites.find(result => result.length === 1)[0];
    const [persistedTable] = await rows(`invitation_tables?id=eq.${tableA.id}`, owner.token);
    check(tableWinner.version === 2 && persistedTable.version === 2 && persistedTable.capacity === tableWinner.capacity,
      'Table winner is persisted at version two');
    await rows(`invitation_project_members?project_id=eq.${a}&user_id=eq.${planner.id}`, owner.token, 'DELETE');
    for (const resource of ['invitation_tables', 'invitation_guests']) {
      check((await rows(`${resource}?project_id=eq.${a}`, planner.token)).length === 0, 'Revoked planner loses read access with same JWT');
      check((await rows(`${resource}?project_id=eq.${a}`, planner.token, 'PATCH', { name: 'Revoked' })).length === 0, 'Revoked planner loses edit access');
    }
    if (verifyConsumer) await verifyConsumer({ users, projects, request, env });
    console.log(`PASS: ${checks} real local Auth/PostgREST checks`);
  } finally {
    // Exact UUID fixtures only, in the already-validated disposable API. Never clear whole tables.
    const failures = [];
    for (const id of projects) {
      try {
        const result = await request(`/rest/v1/invitation_projects?id=eq.${id}`, env.SERVICE_ROLE_KEY, 'DELETE');
        if (!removedProject(result, id)) failures.push('project');
      } catch { failures.push('project request'); }
    }
    for (const user of users) {
      try {
        const result = await request(`/auth/v1/admin/users/${user.id}`, env.SERVICE_ROLE_KEY, 'DELETE');
        const verification = await request(`/auth/v1/admin/users/${user.id}`, env.SERVICE_ROLE_KEY);
        if (!removedUser(result, verification)) failures.push('user');
      } catch { failures.push('user request'); }
    }
    assert.equal(failures.length, 0, 'Synthetic fixture cleanup must succeed');
    console.log('PASS: synthetic fixtures removed');
  }
}
module.exports = { removedProject, removedUser, main };
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
