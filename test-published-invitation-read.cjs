const assert = require('node:assert/strict');
const { readPublishedInvitation } = require('./lib/published-invitation-read.cjs');
const { createPublishedInvitationHandler } = require('./lib/published-invitation-handler.cjs');

const projectId = '20000000-0000-4000-8000-000000000001';
const documentId = '30000000-0000-4000-8000-000000000001';
const project = { id: projectId, status: 'published', published_document_id: documentId };
const document = {
  schemaVersion: 1, projectId, revision: 1, event: { type: 'wedding' }, content: { title: 'Ana y Luis' },
  sections: [{ id: 'details', enabled: true }],
  legacy: { config: { ceremony: { venue: 'Templo', privateNote: 'SECRET_NOTE' }, internalToken: 'SECRET_TOKEN' } },
};
const config = { url: 'https://example.supabase.co', secretKey: 'sb_secret_test_only' };

function fakeFetch({ first = project, last = project, saved = document, savedRevision = 1 } = {}) {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    assert.deepEqual(options.headers, { apikey: config.secretKey });
    if (url.includes('/invitation_projects?')) return {
      ok: true, json: async () => (calls.filter((call) => call.url.includes('/invitation_projects?')).length === 1 ? first : last) ?
        [calls.filter((call) => call.url.includes('/invitation_projects?')).length === 1 ? first : last] : [],
    };
    if (url.includes('/invitation_documents?')) return { ok: true, json: async () => saved ? [{ revision: savedRevision, document: saved }] : [] };
    throw new Error(`Unexpected request: ${url}`);
  };
  return { calls, fetchImpl };
}

function response() {
  return { code: null, headers: {}, body: null, setHeader(k, v) { this.headers[k] = v; },
    status(n) { this.code = n; return this; }, json(v) { this.body = v; return this; } };
}

(async () => {
  const ok = fakeFetch();
  const result = await readPublishedInvitation({ slug: 'ana-luis', config, fetchImpl: ok.fetchImpl });
  assert.equal(result.content.title, 'Ana y Luis');
  assert.equal(result.details.ceremony.venue, 'Templo');
  assert.doesNotMatch(JSON.stringify(result), /SECRET_|legacy|projectId/);
  assert.equal(ok.calls.length, 3);
  assert.ok(ok.calls.every((call) => call.options.redirect === 'error'));

  const untrusted = fakeFetch();
  await assert.rejects(readPublishedInvitation({ slug: 'ana-luis', config: { ...config, url: 'https://attacker.invalid' }, fetchImpl: untrusted.fetchImpl }),
    (error) => error.status === 503);
  assert.equal(untrusted.calls.length, 0);

  const sampleDocument = structuredClone(document);
  sampleDocument.content.primaryName = 'Catalina';
  const sample = fakeFetch({ saved: sampleDocument });
  await assert.rejects(readPublishedInvitation({ slug: 'ana-luis', config, fetchImpl: sample.fetchImpl }),
    (error) => error.status === 404);
  assert.equal(sample.calls.length, 2);

  const emptyInvitation = fakeFetch({ saved: { ...document, sections: [{ id: 'details', enabled: false }] } });
  await assert.rejects(
    readPublishedInvitation({ slug: 'ana-luis', config, fetchImpl: emptyInvitation.fetchImpl }),
    (error) => error.status === 404
  );
  assert.equal(emptyInvitation.calls.length, 2);

  const invalidImage = fakeFetch({ saved: { ...document, assets: { hero: { storagePath: `${documentId}/hero/${documentId}.webp` } }, sections: [{ id: 'hero', enabled: true }] } });
  await assert.rejects(
    readPublishedInvitation({ slug: 'ana-luis', config, fetchImpl: invalidImage.fetchImpl }),
    (error) => error.status === 404
  );
  assert.equal(invalidImage.calls.length, 2);

  const mismatchedRevision = fakeFetch({ savedRevision: 2 });
  await assert.rejects(
    readPublishedInvitation({ slug: 'ana-luis', config, fetchImpl: mismatchedRevision.fetchImpl }),
    (error) => error.status === 404
  );

  for (const [input, setup, expectedCalls] of [
    ['../private', {}, 0],
    ['ana-luis', { first: { ...project, status: 'draft' } }, 1],
    ['ana-luis', { saved: { ...document, projectId: documentId } }, 2],
    ['ana-luis', { last: { ...project, published_document_id: projectId } }, 3],
  ]) {
    const attempt = fakeFetch(setup);
    await assert.rejects(readPublishedInvitation({ slug: input, config, fetchImpl: attempt.fetchImpl }), (error) => error.status === 404);
    assert.equal(attempt.calls.length, expectedCalls);
  }
  await assert.rejects(readPublishedInvitation({ slug: 'ana-luis', config: { url: config.url } }), (error) => error.status === 503);

  const off = createPublishedInvitationHandler({ readInvitation: async () => result, env: {} });
  const offResponse = response();
  await off({ method: 'GET', query: { slug: 'ana-luis' } }, offResponse);
  assert.equal(offResponse.code, 503);
  assert.equal(offResponse.headers['Cache-Control'], 'no-store');

  const on = createPublishedInvitationHandler({
    readInvitation: async () => result,
    env: { INVITTA_PUBLIC_CONTENT_ENABLED: '1', INVITTA_PUBLIC_CONTENT_PREVIEW_SLUG: 'ana-luis',
      SUPABASE_URL: config.url, SUPABASE_SECRET_KEY: config.secretKey },
  });
  const allowed = response();
  await on({ method: 'GET', query: { slug: 'ana-luis' } }, allowed);
  assert.equal(allowed.code, 200);
  assert.deepEqual(allowed.body, result);
  const other = response();
  await on({ method: 'GET', query: { slug: 'otro' } }, other);
  assert.equal(other.code, 404);
  const post = response();
  await on({ method: 'POST', query: {} }, post);
  assert.equal(post.code, 405);
  console.log('Published invitation preview only returns the approved projection for one slug.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
