'use strict';

function createPublishedImageHandler({ readImage, env = process.env }) {
  return async function publishedImageHandler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return res.status(405).json({ success: false, error: 'Método no permitido.' });
    }
    if (env.INVITTA_PUBLIC_ASSETS_ENABLED !== '1' || !env.INVITTA_PUBLIC_ASSET_PREVIEW_SLUG) {
      return res.status(503).json({ success: false, error: 'La entrega pública no está habilitada.' });
    }
    if (!req.query || req.query.slug !== env.INVITTA_PUBLIC_ASSET_PREVIEW_SLUG) {
      return res.status(404).json({ success: false, error: 'La imagen no está disponible.' });
    }
    try {
      const image = await readImage({
        slug: req.query && req.query.slug,
        field: req.query && req.query.field,
        config: { url: env.SUPABASE_URL, secretKey: env.SUPABASE_SECRET_KEY },
      });
      res.setHeader('Content-Type', image.mimeType);
      return res.status(200).send(image.bytes);
    } catch (error) {
      if (error && error.status === 404) return res.status(404).json({ success: false, error: error.message });
      if (error && error.status === 503) return res.status(503).json({ success: false, error: error.message });
      console.error('[Public invitation] Image read failed.');
      return res.status(502).json({ success: false, error: 'No fue posible cargar la imagen.' });
    }
  };
}

module.exports = { createPublishedImageHandler };
