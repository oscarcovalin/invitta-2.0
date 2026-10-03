'use strict';

function failure(res, error) {
  const status = error && [404, 503].includes(error.status) ? error.status : 502;
  if (status === 502) console.error('Public invitation review failed:', error);
  return res.status(status).json({ success: false, error: status === 404
    ? 'La invitación no está disponible.' : 'No fue posible cargar la invitación.' });
}

function baseHandler({ action, env, media = false }) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return res.status(405).json({ success: false, error: 'Método no permitido.' });
    }
    try {
      const result = await action({
        slug: req.query && req.query.slug,
        ...(media ? { field: req.query && req.query.field } : {}),
        config: { url: env.SUPABASE_URL, secretKey: env.SUPABASE_SECRET_KEY },
      });
      if (!media) return res.status(200).json(result);
      res.setHeader('Content-Type', result.mimeType);
      res.setHeader('Content-Disposition', 'inline');
      return res.status(200).send(result.bytes);
    } catch (error) { return failure(res, error); }
  };
}

function createPublicReviewHandler({ readReview, env = process.env }) {
  return baseHandler({ action: readReview, env });
}

function createPublicReviewMediaHandler({ readMedia, env = process.env }) {
  return baseHandler({ action: readMedia, env, media: true });
}

module.exports = { createPublicReviewHandler, createPublicReviewMediaHandler };
