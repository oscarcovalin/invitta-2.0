const assert = require('node:assert/strict');
const fs = require('node:fs');
const { validateRsvpSubmission, submitPublicRsvp } = require('./lib/public-rsvp.cjs');
const { listProjectRsvps, deleteProjectRsvp } = require('./lib/supabase-rsvps.cjs');
const { createPublicRsvpHandler } = require('./lib/public-rsvp-handler.cjs');
const { createProjectRsvpsHandler } = require('./lib/project-rsvps-handler.cjs');
const { ROUTE_KEYS } = require('./lib/api-dispatcher.cjs');

const projectId = '20000000-0000-4000-8000-000000000001';
const responseId = '30000000-0000-4000-8000-000000000001';
const submissionId = '40000000-0000-4000-8000-000000000001';
const userId = '50000000-0000-4000-8000-000000000001';
const slug = `p-${projectId}`;
const config = { url: 'https://example.supabase.co', secretKey: 'sb_secret_test', publishableKey: 'sb_publishable_test' };
const submission = {
  slug, submissionId, guestName: 'María Fernanda López', email: 'guest@example.com',
  attendance: 'confirmed', passes: 2, dietary: 'allergies',
};

function response() {
  return {
    statusCode: null, headers: {}, body: null,
    setHeader(name, value) { this.headers[name] = value; return this; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

function fakeFetch(project = { id: projectId, status: 'published' }) {
  const calls = [];
  return {
    calls,
    fetchImpl: async (url, options) => {
      calls.push({ url: String(url), options });
      assert.equal(options.redirect, 'error');
      if (String(url).includes('/invitation_projects?')) return { ok: true, json: async () => [project] };
      if (String(url).includes('/invitation_rsvps?')) return { ok: true, status: 201, json: async () => [] };
      throw new Error(`Unexpected URL: ${url}`);
    },
  };
}

(async () => {
  assert.deepEqual(validateRsvpSubmission(submission), {
    slug, submissionId, guestName: 'María Fernanda López', email: 'guest@example.com',
    attendance: 'confirmed', passes: 2, dietary: 'allergies',
  });
  for (const invalid of [
    { ...submission, slug: '../private' },
    { ...submission, guestName: 'x' },
    { ...submission, email: 'not-an-email' },
    { ...submission, attendance: 'maybe' },
    { ...submission, passes: 0 },
    { ...submission, attendance: 'declined', passes: 2 },
    { ...submission, dietary: 'free text allergies' },
  ]) assert.throws(() => validateRsvpSubmission(invalid));

  const publicDb = fakeFetch();
  await submitPublicRsvp({ input: submission, config, fetchImpl: publicDb.fetchImpl });
  assert.equal(publicDb.calls.length, 2);
  assert.match(publicDb.calls[0].url, /status=eq\.published/);
  assert.equal(publicDb.calls[0].options.headers.apikey, config.secretKey);
  assert.equal(publicDb.calls[1].options.headers.apikey, config.secretKey);
  assert.equal(publicDb.calls[1].options.headers.Prefer, 'resolution=ignore-duplicates,return=minimal');
  assert.deepEqual(JSON.parse(publicDb.calls[1].options.body), {
    project_id: projectId, submission_id: submissionId, guest_name: 'María Fernanda López',
    email: 'guest@example.com', attendance: 'confirmed', passes: 2, dietary_option: 'allergies',
  });
  await assert.rejects(
    submitPublicRsvp({ input: submission, config, fetchImpl: fakeFetch({ id: projectId, status: 'draft' }).fetchImpl }),
    (error) => error.status === 404,
  );

  const ownerCalls = [];
  const ownerFetch = async (url, options) => {
    ownerCalls.push({ url: String(url), options });
    if (String(url).includes('/invitation_projects?')) {
      return { ok: true, json: async () => [{ id: projectId, owner_user_id: userId, name: 'XV Janna', status: 'published' }] };
    }
    if (options.method === 'GET') return { ok: true, json: async () => [{ id: responseId, guest_name: 'María', attendance: 'confirmed', passes: 2 }] };
    return { ok: true, status: 204, json: async () => null };
  };
  const list = await listProjectRsvps({ accessToken: 'verified-token', userId, projectId, config, fetchImpl: ownerFetch });
  assert.equal(list.project.name, 'XV Janna');
  assert.equal(list.responses[0].guest_name, 'María');
  assert.match(ownerCalls[1].url, /invitation_rsvps/);
  assert.equal(ownerCalls[1].options.headers.Authorization, 'Bearer verified-token');
  await assert.rejects(
    listProjectRsvps({
      accessToken: 'verified-token', userId,
      projectId,
      config,
      fetchImpl: async (url, options) => {
        if (String(url).includes('/invitation_projects?')) {
          return { ok: true, json: async () => [{ id: projectId, owner_user_id: responseId, name: 'Otro proyecto', status: 'published' }] };
        }
        return ownerFetch(url, options);
      },
    }),
    (error) => error.status === 404,
  );
  await deleteProjectRsvp({ accessToken: 'verified-token', userId, projectId, responseId, config, fetchImpl: ownerFetch });
  assert.equal(ownerCalls.at(-1).options.method, 'DELETE');

  const publicHandler = createPublicRsvpHandler({
    submitRsvp: async ({ input }) => { assert.equal(input.slug, slug); return { saved: true }; },
    rateLimit: async () => true,
  });
  const publicOk = response();
  await publicHandler({ method: 'POST', headers: { 'x-real-ip': '192.0.2.1' }, body: submission }, publicOk);
  assert.equal(publicOk.statusCode, 201);
  assert.equal(publicOk.headers['Cache-Control'], 'no-store');
  const limited = response();
  await createPublicRsvpHandler({ submitRsvp: async () => { throw new Error('must not submit'); }, rateLimit: async () => false })
    ({ method: 'POST', headers: {}, body: submission }, limited);
  assert.equal(limited.statusCode, 429);
  const badMethod = response();
  await publicHandler({ method: 'GET', headers: {}, body: {} }, badMethod);
  assert.equal(badMethod.statusCode, 405);

  const authService = {
    ACCESS_COOKIE: 'invitta_access_token',
    parseCookies: (header = '') => Object.fromEntries(header.split(';').map((part) => part.trim().split('='))),
    getAuthConfig: () => config,
    getAuthenticatedUser: async () => ({ id: userId }),
  };
  const projectHandler = createProjectRsvpsHandler({
    authService,
    listRsvps: async () => ({ project: { id: projectId }, responses: [] }),
    deleteRsvp: async () => ({}),
  });
  const privateResponse = response();
  await projectHandler({ method: 'GET', headers: { cookie: 'invitta_access_token=verified-token' }, query: { projectId } }, privateResponse);
  assert.equal(privateResponse.statusCode, 200);
  const anonymous = response();
  await projectHandler({ method: 'GET', headers: {}, query: { projectId } }, anonymous);
  assert.equal(anonymous.statusCode, 401);
  assert.ok(ROUTE_KEYS.includes('public/rsvp'));
  assert.ok(ROUTE_KEYS.includes('projects/rsvps'));

  const migration = fs.readFileSync('./supabase/migrations/20260929150619_add_invitation_rsvps.sql', 'utf8');
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /revoke all on table public\.invitation_rsvps from public, anon, authenticated/i);
  assert.match(migration, /owner_user_id\s*=\s*\(select auth\.uid\(\)\)/i);
  assert.match(migration, /expires_at[\s\S]*180 days/i);
  assert.match(migration, /cron\.schedule/i);
  assert.doesNotMatch(migration, /grant\s+select[^;]*\banon\b/i);

  const template = fs.readFileSync('./template-engine.js', 'utf8');
  assert.match(template, /\/api\/public\/rsvp/);
  assert.match(template, /await saveResponse\.json\(\)/);
  assert.doesNotMatch(template, /Auto-trigger WhatsApp principal[\s\S]{0,100}triggerWhatsApp\(\);/);
  const portal = fs.readFileSync('./portal.html', 'utf8');
  assert.match(portal, /rsvp-responses\.html\?project=/);
  const page = fs.readFileSync('./rsvp-responses.html', 'utf8');
  assert.match(page, /credentials:\s*'same-origin'/);
  assert.match(page, /\/api\/projects\/rsvps/);
  console.log('Public RSVP persists to Supabase; private RSVP listing and deletion require the project owner.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
