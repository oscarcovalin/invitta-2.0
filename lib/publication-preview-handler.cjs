'use strict';

function createPublicationPreviewHandler({ authService, previewPublication }) {
  return async function publicationPreviewHandler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ success: false, error: 'Método no permitido.' });
    }
    const cookies = authService.parseCookies(req.headers && req.headers.cookie);
    const accessToken = cookies[authService.ACCESS_COOKIE];
    if (!accessToken) return res.status(401).json({ success: false, error: 'Sesión no válida.' });
    try {
      const config = authService.getAuthConfig();
      await authService.getAuthenticatedUser({ accessToken, config });
      const { projectId, documentId } = req.body || {};
      const preview = await previewPublication({ accessToken, projectId, documentId, config });
      return res.status(200).json({ success: true, preview });
    } catch (error) {
      if (Number.isInteger(error && error.status) && error.status >= 400 && error.status < 600) {
        return res.status(error.status).json({ success: false, error: error.message });
      }
      console.error('[Projects] Publication preview failed unexpectedly.');
      return res.status(502).json({ success: false, error: 'No fue posible preparar la vista previa.' });
    }
  };
}

module.exports = { createPublicationPreviewHandler };
