'use strict';

const { PublicRsvpError } = require('./public-rsvp.cjs');

function createPublicRsvpHandler({ submitRsvp, rateLimit = async () => true }) {
  return async function publicRsvpHandler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ success: false, error: 'Método no permitido.' });
    }
    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body) || Buffer.byteLength(JSON.stringify(body), 'utf8') > 4096) {
      return res.status(413).json({ success: false, error: 'La respuesta es demasiado grande o no es válida.' });
    }

    const ip = String(req.headers && (req.headers['x-real-ip'] || req.headers['x-forwarded-for']) || 'unknown').split(',')[0].trim().slice(0, 80);
    try {
      const allowed = await rateLimit({ ip, slug: typeof body.slug === 'string' ? body.slug.slice(0, 128) : '' });
      if (!allowed) return res.status(429).json({ success: false, error: 'Recibimos varias respuestas seguidas. Espera un momento e inténtalo de nuevo.' });
      await submitRsvp({ input: body });
      return res.status(201).json({ success: true });
    } catch (error) {
      if (error instanceof PublicRsvpError || (Number.isInteger(error && error.status) && error.status >= 400 && error.status < 600)) {
        return res.status(error.status).json({ success: false, error: error.message });
      }
      console.error('[RSVP] Public submission failed.');
      return res.status(502).json({ success: false, error: 'No fue posible guardar la respuesta. Intenta nuevamente.' });
    }
  };
}

module.exports = { createPublicRsvpHandler };
