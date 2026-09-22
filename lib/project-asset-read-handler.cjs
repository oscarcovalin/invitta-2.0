'use strict';

function createAssetReadHandler({ authService, readAsset }) {
  return async function assetReadHandler(req, res) {
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return res.status(405).json({ success: false, error: 'Método no permitido.' });
    }
    const cookies = authService.parseCookies(req.headers && req.headers.cookie);
    const accessToken = cookies[authService.ACCESS_COOKIE];
    if (!accessToken) return res.status(401).json({ success: false, error: 'Sesión no válida.' });
    try {
      const config = authService.getAuthConfig();
      await authService.getAuthenticatedUser({ accessToken, config });
      const asset = await readAsset({ path: req.query && req.query.path, accessToken, config });
      res.setHeader('Content-Type', asset.mimeType);
      return res.status(200).send(asset.bytes);
    } catch (error) {
      if (Number.isInteger(error && error.status) && error.status >= 400 && error.status < 600) {
        return res.status(error.status).json({ success: false, error: error.message });
      }
      console.error('[Projects] Private asset read failed unexpectedly.');
      return res.status(502).json({ success: false, error: 'No fue posible cargar la imagen.' });
    }
  };
}

module.exports = { createAssetReadHandler };
