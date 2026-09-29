'use strict';

function createAssetUploadHandler({ authService, uploadAsset, randomUUID }) {
  return async function assetUploadHandler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ success: false, error: 'Método no permitido.' });
    }
    if (!/^application\/json(?:;|$)/i.test(String(req.headers && req.headers['content-type'] || ''))) {
      return res.status(415).json({ success: false, error: 'Se requiere JSON.' });
    }
    const cookies = authService.parseCookies(req.headers && req.headers.cookie);
    const accessToken = cookies[authService.ACCESS_COOKIE];
    if (!accessToken) return res.status(401).json({ success: false, error: 'Sesión no válida.' });

    try {
      const config = authService.getAuthConfig();
      await authService.getAuthenticatedUser({ accessToken, config });
      const { projectId, slot, mimeType, base64 } = req.body || {};
      const asset = await uploadAsset({
        projectId, assetId: randomUUID(), slot, mimeType, base64, accessToken, config,
      });
      return res.status(201).json({ success: true, asset });
    } catch (error) {
      if (Number.isInteger(error && error.status) && error.status >= 400 && error.status < 600) {
        return res.status(error.status).json({ success: false, error: error.message });
      }
      console.error('[Projects] Asset upload failed unexpectedly.');
      return res.status(502).json({ success: false, error: 'No fue posible subir el archivo.' });
    }
  };
}

module.exports = { createAssetUploadHandler };
