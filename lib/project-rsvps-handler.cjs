'use strict';
const { resolveRequestSession } = require('./request-auth-session.cjs');

function createProjectRsvpsHandler({ authService, listRsvps, deleteRsvp }) {
  return async function projectRsvpsHandler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (!['GET', 'DELETE'].includes(req.method)) {
      res.setHeader('Allow', 'GET, DELETE');
      return res.status(405).json({ success: false, error: 'Método no permitido.' });
    }
    try {
      const { accessToken, user, config } = await resolveRequestSession({ req, res, authService });
      const args = { accessToken, userId: user.id, projectId: req.query && req.query.projectId, config };
      if (req.method === 'DELETE') {
        const result = await deleteRsvp({ ...args, responseId: req.query && req.query.responseId });
        return res.status(200).json({ success: true, ...result });
      }
      const result = await listRsvps(args);
      return res.status(200).json({ success: true, ...result });
    } catch (error) {
      if (Number.isInteger(error && error.status) && error.status >= 400 && error.status < 600) {
        return res.status(error.status).json({ success: false, error: error.message });
      }
      console.error('[Projects] RSVP list operation failed.');
      return res.status(502).json({ success: false, error: 'No fue posible consultar las confirmaciones.' });
    }
  };
}

module.exports = { createProjectRsvpsHandler };
