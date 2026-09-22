'use strict';

function createProjectHandler({ authService, createProject, randomUUID }) {
  return async function projectCreationHandler(req, res) {
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
      const user = await authService.getAuthenticatedUser({ accessToken, config });
      const project = await createProject({
        accessToken, userId: user.id, projectId: randomUUID(),
        name: req.body && req.body.name,
        eventType: req.body && req.body.eventType,
        config,
      });
      return res.status(201).json({ success: true, project });
    } catch (error) {
      if (Number.isInteger(error && error.status) && error.status >= 400 && error.status < 600) {
        return res.status(error.status).json({ success: false, error: error.message });
      }
      console.error('[Projects] Project creation failed unexpectedly.');
      return res.status(502).json({ success: false, error: 'No fue posible crear el proyecto.' });
    }
  };
}

module.exports = { createProjectHandler };
