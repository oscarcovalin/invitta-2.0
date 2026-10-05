'use strict';
const { resolveRequestSession } = require('./request-auth-session.cjs');

function createProjectRevisionHandler({ authService, saveRevision }) {
  return async function projectRevisionHandler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ success: false, error: 'Método no permitido.' });
    }

    try {
      const { accessToken, user, config } = await resolveRequestSession({ req, res, authService });
      const revision = await saveRevision({
        accessToken,
        userId: user.id,
        document: req.body && req.body.document,
        expectedRevision: req.body && req.body.expectedRevision,
        config,
      });
      return res.status(201).json({ success: true, revision });
    } catch (error) {
      if (Number.isInteger(error && error.status) && error.status >= 400 && error.status < 600) {
        return res.status(error.status).json({ success: false, error: error.message });
      }
      console.error('[Projects] Invitation revision save failed unexpectedly.');
      return res.status(502).json({ success: false, error: 'No fue posible guardar la revisión.' });
    }
  };
}

module.exports = { createProjectRevisionHandler };
