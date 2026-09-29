const assert = require('node:assert/strict');
const fs = require('node:fs');
const { readPublicReview, readPublicReviewMedia } = require('./lib/public-review.cjs');
const { createPublicReviewHandler, createPublicReviewMediaHandler } = require('./lib/public-review-handler.cjs');

const projectId = '20000000-0000-4000-8000-000000000001';
const documentId = '30000000-0000-4000-8000-000000000001';
const imagePath = `${projectId}/hero/40000000-0000-4000-8000-000000000001.webp`;
const countdownPath = `${projectId}/hero/40000000-0000-4000-8000-000000000002.webp`;
const unusedPath = `${projectId}/hero/40000000-0000-4000-8000-000000000003.webp`;
const musicPath = `${projectId}/music/50000000-0000-4000-8000-000000000001.mp3`;
const project = { id: projectId, status: 'published', published_document_id: documentId };
const document = {
  schemaVersion: 1, projectId, revision: 2,
  event: { type: 'quinceanera', startsAt: '2026-11-13T19:30:00-06:00' },
  content: { title: 'Janna Sharlot', primaryName: 'Catalina', secondaryName: 'Julián' },
  sections: [{ id: 'hero', enabled: true }],
  legacy: { config: {
    eventType: 'xv', name: 'Janna Sharlot', brideName: 'Catalina', groomName: 'Julián',
    photos: { hero: imagePath, saveTheDate: unusedPath }, countdownPhoto: countdownPath,
    music: { enabled: true, url: musicPath },
    rsvpWebhookUrl: 'https://private.example/secret', internalToken: 'SECRET_TOKEN',
    vendorCard: { enabled: true, agencyName: 'Invitta Studio' },
  } },
};
const config = { url: 'https://example.supabase.co', secretKey: 'sb_secret_test' };

function fakeFetch({ currentProject = project, saved = document } = {}) {
  const calls = [];
  return { calls, fetchImpl: async (url, options) => {
    calls.push({ url, options });
    assert.equal(options.redirect, 'error');
    assert.deepEqual(options.headers, { apikey: config.secretKey });
    if (url.includes('/invitation_projects?')) return { ok: true, json: async () => [currentProject] };
    if (url.includes('/invitation_documents?')) return { ok: true, json: async () => [{ revision: saved.revision, document: saved }] };
    if (url.includes('/storage/v1/object/authenticated/')) return {
      ok: true, headers: { get: () => '4' },
      body: new ReadableStream({ start(controller) { controller.enqueue(Uint8Array.from([1, 2, 3, 4])); controller.close(); } }),
    };
    throw new Error(`Unexpected URL: ${url}`);
  } };
}

(async () => {
  const reviewFetch = fakeFetch();
  const review = await readPublicReview({ slug: 'janna-sharlot', config, fetchImpl: reviewFetch.fetchImpl });
  assert.equal(review.content.content.primaryName, 'Janna Sharlot');
  assert.equal(review.revision, 2);
  assert.match(review.presentation.photos.hero, /\/api\/public\/review-media\?slug=janna-sharlot&field=photos\.hero/);
  assert.match(review.presentation.countdownPhoto, /\/api\/public\/review-media\?slug=janna-sharlot&field=countdownPhoto/);
  assert.equal(review.presentation.photos.saveTheDate, '');
  assert.match(review.presentation.music.url, /field=music/);
  assert.equal(review.presentation.vendorCard.enabled, false);
  assert.equal(review.presentation.brideName, undefined);
  assert.equal(review.presentation.groomName, undefined);
  assert.equal(review.presentation.rsvpWebhookUrl, undefined);
  assert.doesNotMatch(JSON.stringify(review), /SECRET_TOKEN|private\.example|invitation-assets|\/music\/5000/);
  assert.equal(reviewFetch.calls.length, 3);

  const mediaFetch = fakeFetch();
  const image = await readPublicReviewMedia({ slug: 'janna-sharlot', field: 'photos.hero', config, fetchImpl: mediaFetch.fetchImpl });
  assert.equal(image.mimeType, 'image/webp');
  assert.deepEqual(image.bytes, Buffer.from([1, 2, 3, 4]));
  assert.match(mediaFetch.calls[2].url, /invitation-assets/);

  const countdownImage = await readPublicReviewMedia({ slug: 'janna-sharlot', field: 'countdownPhoto', config, fetchImpl: fakeFetch().fetchImpl });
  assert.equal(countdownImage.mimeType, 'image/webp');

  const music = await readPublicReviewMedia({ slug: 'janna-sharlot', field: 'music', config, fetchImpl: fakeFetch().fetchImpl });
  assert.equal(music.mimeType, 'audio/mpeg');

  await assert.rejects(readPublicReview({ slug: '../private', config, fetchImpl: fakeFetch().fetchImpl }), (error) => error.status === 404);
  await assert.rejects(readPublicReview({ slug: 'janna-sharlot', config, fetchImpl: fakeFetch({ currentProject: { ...project, status: 'draft' } }).fetchImpl }), (error) => error.status === 404);
  await assert.rejects(readPublicReviewMedia({ slug: 'janna-sharlot', field: 'unknown', config, fetchImpl: fakeFetch().fetchImpl }), (error) => error.status === 404);
  const response = () => ({ code: 0, headers: {}, body: null, setHeader(k, v) { this.headers[k] = v; }, status(n) { this.code = n; return this; }, json(v) { this.body = v; return this; }, send(v) { this.body = v; return this; } });
  const reviewHandler = createPublicReviewHandler({ readReview: async () => review, env: { SUPABASE_URL: config.url, SUPABASE_SECRET_KEY: config.secretKey } });
  const publicResponse = response();
  await reviewHandler({ method: 'GET', query: { slug: 'janna-sharlot' } }, publicResponse);
  assert.equal(publicResponse.code, 200);
  assert.equal(publicResponse.headers['Cache-Control'], 'no-store');
  assert.equal(publicResponse.body.presentation.name, 'Janna Sharlot');
  const mediaHandler = createPublicReviewMediaHandler({ readMedia: async () => image, env: { SUPABASE_URL: config.url, SUPABASE_SECRET_KEY: config.secretKey } });
  const mediaResponse = response();
  await mediaHandler({ method: 'GET', query: { slug: 'janna-sharlot', field: 'photos.hero' } }, mediaResponse);
  assert.equal(mediaResponse.headers['Content-Type'], 'image/webp');
  const denied = response();
  await mediaHandler({ method: 'POST', query: {} }, denied);
  assert.equal(denied.code, 405);
  const viewer = fs.readFileSync('./invitacion-publica-client.html', 'utf8');
  assert.match(viewer, /sandbox="allow-scripts allow-forms allow-popups allow-downloads"/);
  assert.doesNotMatch(viewer, /allow-same-origin|portal\.html|invitacion-estudio\.html/);
  assert.match(viewer, /credentials: 'omit'/);
  const template = fs.readFileSync('./template-engine.js', 'utf8');
  assert.match(template, /replace\(\/<\/g, '\\\\u003c'\)/);
  console.log('Public review exposes only published invitation presentation and its referenced media.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
