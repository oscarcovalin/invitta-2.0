'use strict';

function createPublishedInvitationHandler({ readInvitation, env = process.env }) {
  return async function publishedInvitationHandler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return res.status(405).json({ success: false, error: 'Método no permitido.' });
    }
    if (env.INVITTA_PUBLIC_CONTENT_ENABLED !== '1' || !env.INVITTA_PUBLIC_CONTENT_PREVIEW_SLUG) {
      return res.status(503).json({ success: false, error: 'La vista previa no está habilitada.' });
    }
    if (!req.query || req.query.slug !== env.INVITTA_PUBLIC_CONTENT_PREVIEW_SLUG) {
      return res.status(404).json({ success: false, error: 'La invitación no está disponible.' });
    }
    try {
      const invitation = await readInvitation({
        slug: req.query.slug,
        config: { url: env.SUPABASE_URL, secretKey: env.SUPABASE_SECRET_KEY },
      });
      return res.status(200).json(invitation);
    } catch (error) {
      if (error && (error.status === 404 || error.status === 503)) {
        return res.status(error.status).json({ success: false, error: error.message });
      }
      console.error('[Public invitation] Content read failed.');
      return res.status(502).json({ success: false, error: 'No fue posible cargar la invitación.' });
    }
  };
}

module.exports = { createPublishedInvitationHandler };
