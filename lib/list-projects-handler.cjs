'use strict';

function createListProjectsHandler({ authService, listProjects }) {
  return async function listProjectsHandler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
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
      const projects = await listProjects({ accessToken, config });
      return res.status(200).json({ success: true, projects });
    } catch (error) {
      if (Number.isInteger(error && error.status) && error.status >= 400 && error.status < 600) {
        return res.status(error.status).json({ success: false, error: error.message });
      }
      console.error('[Projects] Project list failed unexpectedly.');
      return res.status(502).json({ success: false, error: 'No fue posible consultar los proyectos.' });
    }
  };
}

module.exports = { createListProjectsHandler };
