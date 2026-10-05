'use strict';
const { resolveRequestSession } = require('./request-auth-session.cjs');

function createAssetReadHandler({ authService, readAsset }) {
  return async function assetReadHandler(req, res) {
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return res.status(405).json({ success: false, error: 'Método no permitido.' });
    }
    try {
      const { accessToken, config } = await resolveRequestSession({ req, res, authService });
      const asset = await readAsset({ path: req.query && req.query.path, accessToken, config });
      res.setHeader('Content-Type', asset.mimeType);
      return res.status(200).send(asset.bytes);
    } catch (error) {
      if (Number.isInteger(error && error.status) && error.status >= 400 && error.status < 600) {
        return res.status(error.status).json({ success: false, error: error.message });
      }
      console.error('[Projects] Private asset read failed unexpectedly.');
      return res.status(502).json({ success: false, error: 'No fue posible cargar el archivo.' });
    }
  };
}

module.exports = { createAssetReadHandler };
