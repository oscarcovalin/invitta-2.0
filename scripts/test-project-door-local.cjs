'use strict';
// Real Auth/PostgREST requests; the shared harness validates disposable project,
// localhost ports and absence of a remote link before this callback can run.
const assert = require('node:assert/strict');
const { randomUUID, randomBytes, createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { resolve } = require('node:path');
const { main } = require('./test-project-operations-local.cjs');

const snapshotKeys = ['ticketId', 'guestId', 'projectId', 'name', 'passes', 'admitted',
  'remaining', 'expiresAt', 'revoked', 'projectName', 'tableName'].sort();
const publicKeys = ['name', 'passes', 'admitted', 'remaining', 'expiresAt', 'revoked',
  'projectName', 'tableName'].sort();
const admissionKeys = ['operationId', 'ticketId', 'count', 'admitted', 'remaining', 'confirmedAt'].sort();
const digest = () => createHash('sha256').update(randomBytes(32)).digest('hex');

async function verifyConsumer({ users, projects, request, env }) {
  const [owner, planner, designer, hostess, catering, viewer, outsider] = users;
  const [a, b] = projects;
  let checks = 0;
  function check(value, label) { assert(value, label); checks++; }
  function same(actual, expected, label) { assert.deepEqual(actual, expected, label); checks++; }
  async function successful(path, user, method = 'GET', body) {
    const result = await request(`/rest/v1/${path}`, user.token, method, body);
    check(result.status >= 200 && result.status < 300,
      `${method} ${path.split('?')[0]}: HTTP ${result.status}, code ${result.data?.code || 'none'}`);
    return result.data;
  }
  async function rpc(name, user, body, expectedCode) {
    const result = await request(`/rest/v1/rpc/invitation_pass_${name}`, user?.token || env.ANON_KEY, 'POST', body);
    if (expectedCode) {
      check(result.status >= 400 && result.data?.code === expectedCode,
        `${name}: expected ${expectedCode}, got HTTP ${result.status} / ${result.data?.code || 'none'}`);
    } else {
      check(result.status >= 200 && result.status < 300,
        `${name}: HTTP ${result.status}, code ${result.data?.code || 'none'}`);
      check(result.data && !Array.isArray(result.data) && typeof result.data === 'object', `${name} returns one JSON object`);
    }
    return result.data;
  }
  function issueInput(overrides = {}) {
    return { p_project: a, p_operation: randomUUID(), p_name: `Synthetic door ${randomUUID()}`,
      p_passes: 4, p_table: null, p_immediate: false, p_digest: digest(), ...overrides };
  }
  const inspectInput = input => ({ p_project: input.p_project, p_ticket: input.p_operation, p_digest: input.p_digest });
  function admitInput(input, count, operation = randomUUID()) {
    return { ...inspectInput(input), p_operation: operation, p_count: count };
  }
  function validateSnapshot(value, input, admitted, remaining) {
    same(Object.keys(value).sort(), snapshotKeys, 'Private snapshot has only contracted fields');
    same([value.ticketId, value.projectId, value.name, value.passes, value.admitted, value.remaining, value.revoked],
      [input.p_operation, input.p_project, input.p_name, input.p_passes, admitted, remaining, false], 'Private snapshot matches issuance');
    check(/^[0-9a-f-]{36}$/i.test(value.guestId), 'Issuance returns a database guest UUID');
    check(Number.isFinite(Date.parse(value.expiresAt)), 'Expiry is a server timestamp');
  }

  // The operations harness deliberately removed planner before invoking us.
  await successful('invitation_project_members', owner, 'POST', { project_id: a, user_id: planner.id, role: 'planner' });
  await successful('invitation_project_members', owner, 'POST', { project_id: b, user_id: outsider.id, role: 'hostess' });
  const [tableA] = await successful('invitation_tables', owner, 'POST',
    { project_id: a, name: 'Door synthetic table', type: 'circular', capacity: 20 });
  const [tableB] = await successful('invitation_tables', owner, 'POST',
    { project_id: b, name: 'Other project door table', type: 'circular', capacity: 20 });

  // This first call is the RED reproduction against the schema preceding doors.
  for (const [user,canIssue] of [[owner,true],[planner,true],[hostess,false]]) {
    same(await rpc('context',user,{p_project:a}),{projectName:'Local a',canIssue,canAdmit:true},'Context follows explicit project membership');
  }
  for (const user of [designer,catering,viewer,outsider,null]) await rpc('context',user,{p_project:a},'42501');
  const family = issueInput({ p_table: tableA.id });
  const beforeIssue = Date.now();
  const issued = await rpc('issue', owner, family);
  const afterIssue = Date.now();
  validateSnapshot(issued, family, 0, 4);
  check(Date.parse(issued.expiresAt) >= beforeIssue + 24 * 60 * 60 * 1000 - 2000
    && Date.parse(issued.expiresAt) <= afterIssue + 24 * 60 * 60 * 1000 + 2000, 'Database grants precisely 24 hours');
  same([issued.projectName, issued.tableName], ['Local a', tableA.name], 'Snapshot includes only this project and table labels');
  const [guest] = await successful(`invitation_guests?id=eq.${issued.guestId}&project_id=eq.${a}`, owner);
  check(guest?.name === family.p_name && guest.passes === 4 && guest.table_id === tableA.id && guest.version === 1,
    'Issuance atomically creates the organizer guest at version one');
  same(await rpc('issue', owner, family), issued, 'Identical issue retry recovers original result');
  const matchingGuests = await successful(`invitation_guests?project_id=eq.${a}&name=eq.${encodeURIComponent(family.p_name)}`, owner);
  check(matchingGuests.length === 1, 'Issue retry created one guest');

  for (const user of [owner, planner, hostess]) {
    same(await rpc('inspect', user, inspectInput(family)), issued, `${user.role} reads the same ticket`);
  }
  const publicPass = await rpc('public', null, inspectInput(family));
  same(Object.keys(publicPass).sort(), publicKeys, 'Public bearer read exposes only contracted minimal fields');
  same(publicPass, Object.fromEntries(publicKeys.map(key => [key, issued[key]])), 'Public data belongs only to this ticket');
  await rpc('public', null, { ...inspectInput(family), p_digest: digest() }, 'P0002');
  await rpc('public', null, { ...inspectInput(family), p_project: b }, 'P0002');
  await rpc('public', null, { ...inspectInput(family), p_ticket: randomUUID() }, 'P0002');

  for (const user of [designer, catering, viewer, outsider, null]) {
    await rpc('issue', user, issueInput(), '42501');
    await rpc('inspect', user, inspectInput(family), '42501');
    await rpc('admit', user, admitInput(family, 1), '42501');
    await rpc('revoke', user, { p_project: a, p_ticket: family.p_operation }, '42501');
  }
  await rpc('issue', hostess, issueInput(), '42501');
  await rpc('revoke', hostess, { p_project: a, p_ticket: family.p_operation }, '42501');
  for (const action of ['issue', 'inspect', 'admit', 'revoke']) {
    const input = action === 'issue' ? issueInput({ p_project: b })
      : action === 'admit' ? { ...admitInput(family, 1), p_project: b }
        : action === 'inspect' ? { ...inspectInput(family), p_project: b }
          : { p_project: b, p_ticket: family.p_operation };
    await rpc(action, planner, input, '42501');
  }
  await rpc('inspect', owner, { ...inspectInput(family), p_project: b }, 'P0002');
  await rpc('admit', owner, { ...admitInput(family, 1), p_project: b }, 'P0002');
  await rpc('revoke', owner, { p_project: b, p_ticket: family.p_operation }, 'P0002');
  await rpc('inspect', hostess, { ...inspectInput(family), p_digest: digest() }, 'P0002');
  await rpc('admit', hostess, { ...admitInput(family, 1), p_digest: digest() }, 'P0002');
  await rpc('inspect', owner, { ...inspectInput(family), p_ticket: randomUUID() }, 'P0002');
  await rpc('admit', owner, { ...admitInput(family, 1), p_ticket: randomUUID() }, 'P0002');

  const beforeInvalid = (await successful(`invitation_guests?project_id=eq.${a}`, owner)).length;
  for (const invalid of [{ p_passes: 0 }, { p_passes: 21 }, { p_name: ' ' }, { p_name: 'x'.repeat(161) }, { p_digest: 'invalid' }]) {
    await rpc('issue', owner, issueInput(invalid), '23514');
  }
  await rpc('issue', owner, issueInput({ p_table: tableB.id }), '23503');
  await rpc('issue', owner, issueInput({ p_table: randomUUID() }), '23503');
  same((await successful(`invitation_guests?project_id=eq.${a}`, owner)).length, beforeInvalid, 'Rejected issuance never creates a guest');
  for (const changed of [{ p_name: 'Changed intent' }, { p_passes: 3 }, { p_table: null }, { p_immediate: true }, { p_digest: digest() }]) {
    await rpc('issue', owner, { ...family, ...changed }, 'P0001');
  }
  await rpc('issue', planner, family, 'P0001');

  const plannerInput = issueInput({ p_passes: 1 });
  const plannerPass = await rpc('issue', planner, plannerInput);
  validateSnapshot(plannerPass, plannerInput, 0, 1);
  const immediateInput = issueInput({ p_passes: 2, p_immediate: true });
  const immediate = await rpc('issue', owner, immediateInput);
  validateSnapshot(immediate, immediateInput, 2, 0);
  same(await rpc('issue', owner, immediateInput), immediate, 'Immediate issuance retry cannot admit twice');
  await rpc('admit', hostess, admitInput(immediateInput, 1), 'P0001');

  const firstInput = admitInput(family, 2);
  const first = await rpc('admit', hostess, firstInput);
  same(Object.keys(first).sort(), admissionKeys, 'Admission exposes only contracted result fields');
  same([first.operationId, first.ticketId, first.count, first.admitted, first.remaining],
    [firstInput.p_operation, family.p_operation, 2, 2, 2], 'First group admits two and leaves two');
  check(Number.isFinite(Date.parse(first.confirmedAt)), 'Admission timestamp comes from the database');
  same(await rpc('issue', owner, family), issued, 'Issue retry returns issuance snapshot after later admission');
  for (const count of [0, -1, 21]) await rpc('admit', hostess, admitInput(family, count), '23514');
  await rpc('admit', hostess, { ...firstInput, p_count: 1 }, 'P0001');
  await rpc('admit', planner, firstInput, 'P0001');
  await rpc('admit', hostess, { ...firstInput, p_digest: digest() }, 'P0001');
  const second = await rpc('admit', planner, admitInput(family, 2));
  same([second.admitted, second.remaining], [4, 0], 'Separate second group consumes remaining two');
  same(await rpc('admit', hostess, firstInput), first, 'Old admission retry returns its original partial result');
  await rpc('admit', hostess, admitInput(family, 1), 'P0001');
  const full = await rpc('inspect', hostess, inspectInput(family));
  same([full.admitted, full.remaining], [4, 0], 'Rejected operations left full balance unchanged');
  const reduction = await request(`/rest/v1/invitation_guests?id=eq.${issued.guestId}`, owner.token, 'PATCH', { passes: 3 });
  check(reduction.status >= 400 && reduction.data?.code === '23514', 'Direct guest PATCH cannot reduce passes below admitted');
  const [afterReduction] = await successful(`invitation_guests?id=eq.${issued.guestId}`, owner);
  same([afterReduction.passes, afterReduction.version], [4, guest.version], 'Failed reduction changes neither passes nor version');

  const lastInput = issueInput({ p_passes: 1 });
  await rpc('issue', owner, lastInput);
  const races = await Promise.all([owner, hostess].map(user => request('/rest/v1/rpc/invitation_pass_admit',
    user.token, 'POST', admitInput(lastInput, 1))));
  same(races.filter(result => result.status >= 200 && result.status < 300).length, 1, 'Two scanners competing for last pass have one winner');
  same(races.filter(result => result.status >= 400 && result.data?.code === 'P0001').length, 1, 'Other scanner receives balance conflict');
  const last = await rpc('inspect', hostess, inspectInput(lastInput));
  same([last.admitted, last.remaining], [1, 0], 'Concurrent last pass is counted once');

  const duplicateInput = issueInput({ p_passes: 3 });
  await rpc('issue', owner, duplicateInput);
  const sameOperation = admitInput(duplicateInput, 2);
  const duplicateResults = await Promise.all([rpc('admit', hostess, sameOperation), rpc('admit', hostess, sameOperation)]);
  same(duplicateResults[0], duplicateResults[1], 'Concurrent identical operation returns one stable result');
  const duplicateState = await rpc('inspect', hostess, inspectInput(duplicateInput));
  same([duplicateState.admitted, duplicateState.remaining], [2, 1], 'Concurrent retry increments counter only once');
  const concurrentIssue = issueInput({ p_passes: 3, p_immediate: true });
  const issuedTwice = await Promise.all([rpc('issue', planner, concurrentIssue), rpc('issue', planner, concurrentIssue)]);
  same(issuedTwice[0], issuedTwice[1], 'Concurrent immediate issuance returns one original result');
  same([issuedTwice[0].admitted, issuedTwice[0].remaining], [3, 0], 'Concurrent immediate issuance consumes exactly authorized passes');
  same((await successful(`invitation_guests?project_id=eq.${a}&name=eq.${encodeURIComponent(concurrentIssue.p_name)}`, owner)).length,
    1, 'Concurrent issuance creates one organizer guest');

  const changing = issueInput({p_passes:3});
  const changingPass = await rpc('issue',owner,changing);
  const [changeAdmission,reductionRace] = await Promise.all([
    request('/rest/v1/rpc/invitation_pass_admit',hostess.token,'POST',admitInput(changing,3)),
    request(`/rest/v1/invitation_guests?id=eq.${changingPass.guestId}`,owner.token,'PATCH',{passes:2})
  ]);
  const changed = await rpc('inspect',hostess,inspectInput(changing));
  if(changeAdmission.status<300){
    same([changed.passes,changed.admitted,changed.remaining],[3,3,0],'Admission wins reduction race without violating balance');
    check(reductionRace.status>=400 && reductionRace.data?.code==='23514','Reduction below raced admission rejected');
  }else{
    check(changeAdmission.data?.code==='P0001' && reductionRace.status<300,'Reduced authorization rejects raced admission');
    same([changed.passes,changed.admitted,changed.remaining],[2,0,2],'Reduction winner leaves zero admissions');
  }
  const revoking = issueInput({p_passes:2});
  await rpc('issue',owner,revoking);const revokingAdmission=admitInput(revoking,1);
  const [entryRace,revokeRace] = await Promise.all([
    request('/rest/v1/rpc/invitation_pass_admit',hostess.token,'POST',revokingAdmission),
    request('/rest/v1/rpc/invitation_pass_revoke',owner.token,'POST',{p_project:a,p_ticket:revoking.p_operation})
  ]);
  check(revokeRace.status<300 && revokeRace.data.revoked===true,'Revocation commits during admission race');
  if(entryRace.status<300) same(await rpc('admit',hostess,revokingAdmission),entryRace.data,'Committed admission survives raced revocation');
  else check(entryRace.data?.code==='P0002','Revocation winner prevents raced entry');
  await rpc('admit',hostess,admitInput(revoking,1),'P0002');

  // Revocation preserves committed admissions and permits safe identical replay.
  same(await rpc('revoke', planner, { p_project: a, p_ticket: duplicateInput.p_operation }),
    { ticketId: duplicateInput.p_operation, revoked: true }, 'Planner revokes a project ticket');
  same(await rpc('revoke', owner, { p_project: a, p_ticket: duplicateInput.p_operation }),
    { ticketId: duplicateInput.p_operation, revoked: true }, 'Revocation is stable');
  await rpc('inspect', hostess, inspectInput(duplicateInput), 'P0002');
  await rpc('public', null, inspectInput(duplicateInput), 'P0002');
  await rpc('admit', hostess, admitInput(duplicateInput, 1), 'P0002');
  same(await rpc('admit', hostess, sameOperation), duplicateResults[0], 'Revoked ticket still recovers committed identical operation');
  same(await rpc('issue', owner, duplicateInput),
    { ...duplicateState, admitted: 0, remaining: 3 }, 'Revoked ticket issue retry returns original snapshot');

  const expiryInput = issueInput({ p_passes: 2 });
  await rpc('issue', owner, expiryInput);
  const expiryAdmission = admitInput(expiryInput, 1);
  const expiryResult = await rpc('admit', hostess, expiryAdmission);
  // Admin SQL is restricted to fixture clock setup after validated local harness.
  // Do not print CLI output: tooling can include local connection credentials.
  assert.match(expiryInput.p_operation, /^[0-9a-f-]{36}$/i);
  assert.match(a, /^[0-9a-f-]{36}$/i);
  const expired = spawnSync(process.argv[3], ['db', 'query', '--local', '--workdir', resolve(process.argv[2]),
    `update private.invitation_passes set expires_at = now() - interval '1 second' where id = '${expiryInput.p_operation}'::uuid and project_id = '${a}'::uuid`],
  { encoding: 'utf8', timeout: 30000 });
  check(expired.status === 0, 'Synthetic expiry fixture updates only exact local project/ticket UUID');
  await rpc('inspect', owner, inspectInput(expiryInput), 'P0002');
  await rpc('public', null, inspectInput(expiryInput), 'P0002');
  await rpc('admit', hostess, admitInput(expiryInput, 1), 'P0002');
  same(await rpc('admit', hostess, expiryAdmission), expiryResult, 'Expired ticket recovers committed identical operation');

  // There must be no public counter table and private schema must remain hidden.
  for (const user of [owner, hostess, null]) {
    for (const resource of ['invitation_passes', 'invitation_admissions']) {
      for (const method of ['GET', 'POST', 'PATCH']) {
        const result = await request(`/rest/v1/${resource}`, user?.token || env.ANON_KEY, method,
          method === 'GET' ? undefined : { project_id: a, admitted: 999 });
        check(result.status >= 400 && ['PGRST205', '42P01', '42501'].includes(result.data?.code), `${resource} cannot be accessed in public schema`);
        const response = await fetch(new URL(`/rest/v1/${resource}`, env.API_URL), {
          method, redirect: 'error', signal: AbortSignal.timeout(15000),
          headers: { apikey: env.ANON_KEY, Authorization: `Bearer ${user?.token || env.ANON_KEY}`,
            'Content-Type': 'application/json', 'Accept-Profile': 'private', 'Content-Profile': 'private' },
          ...(method === 'GET' ? {} : { body: JSON.stringify({ project_id: a, admitted: 999 }) })
        });
        const data = await response.json();
        check(response.status >= 400 && ['PGRST106', '42501'].includes(data.code), `${resource} private direct ${method} is forbidden`);
      }
    }
  }
  await successful(`invitation_project_members?project_id=eq.${a}&user_id=eq.${hostess.id}`, owner, 'DELETE');
  await rpc('inspect', hostess, inspectInput(family), '42501');
  await rpc('admit', hostess, admitInput(plannerInput, 1), '42501');
  await successful(`invitation_project_members?project_id=eq.${a}&user_id=eq.${planner.id}`, owner, 'DELETE');
  await rpc('issue', planner, issueInput(), '42501');
  await rpc('inspect', planner, inspectInput(family), '42501');
  await rpc('admit', planner, admitInput(plannerInput, 1), '42501');
  console.log(`PASS: ${checks} real local Auth/PostgREST door checks`);
}

module.exports = { verifyConsumer };
if (require.main === module) main({ verifyConsumer }).catch(error => {
  // Contract assertions use status/code and labels, never response credentials.
  console.error(error.message); process.exitCode = 1;
});
