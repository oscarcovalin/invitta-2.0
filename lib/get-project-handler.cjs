'use strict';
const { resolveRequestSession } = require('./request-auth-session.cjs');

function createGetProjectHandler({ authService, getProject }) {
  return async function getProjectHandler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return res.status(405).json({ success: false, error: 'Método no permitido.' });
    }
    try {
      const { accessToken, config } = await resolveRequestSession({ req, res, authService });
      const project = await getProject({ accessToken, projectId: req.query && req.query.projectId, config });
      return res.status(200).json({ success: true, project });
    } catch (error) {
      if (Number.isInteger(error && error.status) && error.status >= 400 && error.status < 600) {
        return res.status(error.status).json({ success: false, error: error.message });
      }
      console.error('[Projects] Project load failed unexpectedly.');
      return res.status(502).json({ success: false, error: 'No fue posible cargar el proyecto.' });
    }
  };
}

module.exports = { createGetProjectHandler };
