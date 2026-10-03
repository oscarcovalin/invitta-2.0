const assert = require('node:assert/strict');
const fs = require('node:fs');
const { getShareMetadata, renderSharePage, createPublicSharePreviewHandler } = require('./lib/public-share-preview-handler.cjs');

const slug = 'p-a769a84d-ca84-4dad-a1bd-6e35ac66ea21';
const image = `https://invitta.example/api/public/review-media?slug=${slug}&field=photos.hero`;
const review = { presentation: {
  eventType: 'xv', name: 'Janna Sharlot', theme: 'vino',
  photos: { hero: `/api/public/review-media?slug=${slug}&field=photos.hero` },
} };

function response() {
  return {
    code: 0, headers: {}, body: null,
    setHeader(key, value) { this.headers[key] = value; },
    status(code) { this.code = code; return this; },
    send(body) { this.body = body; return this; },
  };
}

(async () => {
  const metadata = getShareMetadata(review.presentation);
  assert.equal(metadata.title, 'XV Janna | Invitta Studio');
  assert.equal(metadata.description, 'Acompáñanos a celebrar los XV años de Janna. Consulta todos los detalles de la invitación.');

  const html = renderSharePage({ slug, origin: 'https://invitta.example', review });
  assert.match(html, /<meta property="og:title" content="XV Janna \| Invitta Studio">/);
  assert.match(html, /<meta property="og:description" content="Acompáñanos a celebrar los XV años de Janna\./);
  assert.ok(html.includes(`<meta property="og:image" content="${image.replace(/&/g, '&amp;')}">`));
  assert.match(html, /<meta name="twitter:card" content="summary_large_image">/);
  assert.match(html, /<script src="\/public-rsvp-bridge\.js"><\/script>/);
  assert.match(html, /InvittaPublicRsvpBridge\.attach\(frame, slug\)/);
  assert.match(html, /sandbox="allow-scripts allow-forms allow-popups allow-downloads"/);
  assert.doesNotMatch(html, /allow-same-origin|portal\.html|invitacion-estudio\.html/);
  assert.doesNotMatch(renderSharePage({ slug, origin: 'https://invitta.example', review: {
    presentation: { ...review.presentation, photos: { hero: 'https://attacker.example/preview.jpg' } },
  } }), /attacker\.example/);

  const handler = createPublicSharePreviewHandler({ readReview: async () => review, env: {} });
  const publicResponse = response();
  await handler({ method: 'GET', headers: { host: 'invitta.example' }, query: { slug } }, publicResponse);
  assert.equal(publicResponse.code, 200);
  assert.equal(publicResponse.headers['Content-Type'], 'text/html; charset=utf-8');
  assert.equal(publicResponse.headers['Cache-Control'], 'no-store');
  assert.match(publicResponse.body, /XV Janna \| Invitta Studio/);

  const rejected = response();
  await handler({ method: 'POST', headers: { host: 'invitta.example' }, query: { slug } }, rejected);
  assert.equal(rejected.code, 405);

  const config = JSON.parse(fs.readFileSync('./vercel.json', 'utf8'));
  assert.equal(config.rewrites[0].source, '/invitacion-publica.html');
  assert.equal(config.rewrites[0].destination, '/api/index?route=public/share-preview');
  assert.equal(fs.existsSync('./invitacion-publica.html'), false);
  console.log('Public invitation share links include WhatsApp-ready title, description, and hero image metadata.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
