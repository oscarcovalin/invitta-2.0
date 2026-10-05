'use strict';
const { resolveRequestSession } = require('./request-auth-session.cjs');

function createPublishRevisionHandler({ authService, publishRevision }) {
  return async function publishRevisionHandler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ success: false, error: 'Método no permitido.' });
    }

    try {
      const { accessToken, config } = await resolveRequestSession({ req, res, authService });
      const { projectId, documentId } = req.body || {};
      const project = await publishRevision({ accessToken, projectId, documentId, config });
      return res.status(200).json({ success: true, project });
    } catch (error) {
      if (Number.isInteger(error && error.status) && error.status >= 400 && error.status < 600) {
        return res.status(error.status).json({ success: false, error: error.message });
      }
      console.error('[Projects] Invitation revision publish failed unexpectedly.');
      return res.status(502).json({ success: false, error: 'No fue posible publicar la revisión.' });
    }
  };
}

module.exports = { createPublishRevisionHandler };
