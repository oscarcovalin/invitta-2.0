'use strict';

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

function normalizeInvitationName(value) {
  return typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim() : '';
}

function getShareMetadata(presentation = {}) {
  const fullName = normalizeInvitationName(presentation.name) || 'Invitación';
  const eventName = fullName.replace(/^(?:mis\s+)?(?:xv|15\s*años?)(?:\s+de)?\s*/i, '').trim() || fullName;
  const firstName = eventName.split(/\s+/)[0] || 'Janna';
  const isXv = presentation.eventType === 'xv';
  const title = isXv ? `XV ${firstName} | Invitta Studio` : `${fullName} | Invitta Studio`;
  const description = isXv
    ? `Acompáñanos a celebrar los XV años de ${firstName}. Consulta todos los detalles de la invitación.`
    : `Acompáñanos a celebrar con ${fullName}. Consulta todos los detalles de la invitación.`;
  const imagePath = presentation.photos && presentation.photos.hero
    || presentation.countdownPhoto
    || presentation.photos && presentation.photos.portrait;
  return { title, description, imagePath };
}

function requestOrigin(req) {
  const headers = req.headers || {};
  const forwardedHost = headers['x-forwarded-host'];
  const rawHost = Array.isArray(forwardedHost) ? forwardedHost[0]
    : forwardedHost || headers.host || headers.Host;
  const host = String(rawHost || '').split(',')[0].trim();
  if (!host || !/^[a-z0-9.-]+(?::\d{1,5})?$/i.test(host) || host.includes('..')) {
    const error = new Error('Invalid request host.');
    error.status = 400;
    throw error;
  }
  const forwardedProtocol = headers['x-forwarded-proto'];
  const protocol = (Array.isArray(forwardedProtocol) ? forwardedProtocol[0] : forwardedProtocol || 'https')
    .split(',')[0].trim().toLowerCase();
  if (protocol !== 'http' && protocol !== 'https') {
    const error = new Error('Invalid request protocol.');
    error.status = 400;
    throw error;
  }
  return `${protocol}://${host}`;
}

function allowedImageUrl(imagePath, { origin, slug }) {
  if (typeof imagePath !== 'string' || !imagePath) return '';
  let image;
  try { image = new URL(imagePath, origin); } catch (_) { return ''; }
  if (image.origin !== origin) return '';
  if (image.pathname === '/api/public/review-media') {
    const allowedFields = new Set(['photos.hero', 'photos.portrait', 'countdownPhoto']);
    if (image.searchParams.get('slug') !== slug || !allowedFields.has(image.searchParams.get('field'))) return '';
    return image.href;
  }
  if (/^\/assets\/[a-z0-9._/-]+\.(?:jpg|jpeg|png|webp|gif)$/i.test(image.pathname)) return image.href;
  return '';
}

function renderSharePage({ slug, origin, review }) {
  const metadata = getShareMetadata(review.presentation);
  const title = escapeHtml(metadata.title);
  const description = escapeHtml(metadata.description);
  const canonicalUrl = new URL(`/invitacion-publica.html?slug=${encodeURIComponent(slug)}`, origin).href;
  const imageUrl = allowedImageUrl(metadata.imagePath, { origin, slug });
  const imageTags = imageUrl
    ? `<meta property="og:image" content="${escapeHtml(imageUrl)}">
  <meta property="og:image:secure_url" content="${escapeHtml(imageUrl)}">
  <meta property="og:image:alt" content="${title}">
  <meta name="twitter:image" content="${escapeHtml(imageUrl)}">`
    : '';

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <meta name="description" content="${description}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Invitta Studio">
  <meta property="og:locale" content="es_MX">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:url" content="${escapeHtml(canonicalUrl)}">
  ${imageTags}
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${description}">
  <title>${title}</title>
  <script src="/template-engine.js"></script>
  <style>
    html, body { margin: 0; min-height: 100%; background: #f8f7f5; color: #24302d; font-family: system-ui, sans-serif; }
    #status { box-sizing: border-box; display: grid; place-items: center; min-height: 100vh; padding: 32px; text-align: center; line-height: 1.5; }
    #invitation { display: block; width: 100%; height: 100vh; min-height: 100dvh; border: 0; }
    [hidden] { display: none !important; }
  </style>
</head>
<body>
  <main id="status" role="status" aria-live="polite">Cargando invitación…</main>
  <iframe id="invitation" title="${title}" sandbox="allow-scripts allow-forms allow-popups allow-downloads" referrerpolicy="no-referrer" hidden></iframe>
  <script>
    (async () => {
      const status = document.getElementById('status');
      const frame = document.getElementById('invitation');
      const slug = new URLSearchParams(location.search).get('slug');
      if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
        status.textContent = 'Este enlace de invitación no es válido.';
        return;
      }
      try {
        const response = await fetch('/api/public/review?slug=' + encodeURIComponent(slug), { cache: 'no-store', credentials: 'omit' });
        if (!response.ok) throw new Error('La invitación todavía no está disponible.');
        const review = await response.json();
        if (!review.presentation || typeof TemplateEngine === 'undefined') throw new Error('No fue posible abrir la invitación.');
        const presentation = review.presentation;
        frame.srcdoc = TemplateEngine.generateHTML(presentation, presentation.theme || 'vino');
        frame.hidden = false;
        status.hidden = true;
      } catch (error) {
        status.textContent = error.message || 'No fue posible abrir la invitación.';
      }
    })();
  </script>
</body>
</html>`;
}

function createPublicSharePreviewHandler({ readReview, env = process.env }) {
  return async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return res.status(405).send('Método no permitido.');
    }
    const slug = req.query && req.query.slug;
    if (typeof slug !== 'string' || !SLUG.test(slug)) return res.status(404).send('La invitación no está disponible.');
    try {
      const [origin, review] = await Promise.all([
        Promise.resolve().then(() => requestOrigin(req)),
        readReview({ slug, config: { url: env.SUPABASE_URL, secretKey: env.SUPABASE_SECRET_KEY } }),
      ]);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(200).send(renderSharePage({ slug, origin, review }));
    } catch (error) {
      const status = error && [404, 503].includes(error.status) ? error.status : 502;
      if (status === 502) console.error('Public invitation share preview failed:', error);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(status).send(status === 404
        ? 'La invitación no está disponible.' : 'No fue posible cargar la invitación.');
    }
  };
}

module.exports = { createPublicSharePreviewHandler, getShareMetadata, renderSharePage };
