'use strict';

const { AuthServiceError } = require('./supabase-auth-service.cjs');

async function resolveRequestSession({ req, res, authService }) {
  const cookies = authService.parseCookies(req.headers && req.headers.cookie);
  const accessToken = cookies[authService.ACCESS_COOKIE];
  const refreshToken = cookies[authService.REFRESH_COOKIE];
  if (!accessToken && !refreshToken) throw new AuthServiceError('UNAUTHENTICATED', 'Sesión no válida.', 401);
  const config = authService.getAuthConfig();
  if (accessToken) {
    try {
      const user = await authService.getAuthenticatedUser({ accessToken, config });
      return { accessToken, user, config };
    } catch (error) {
      // An outage or configuration error must not rotate or erase credentials.
      if (error.code !== 'UNAUTHENTICATED' || error.status !== 401) throw error;
    }
  }
  if (!refreshToken) throw new AuthServiceError('UNAUTHENTICATED', 'Sesión no válida.', 401);

  try {
    const refreshed = await authService.refreshAuthSession({ refreshToken, config });
    res.setHeader('Set-Cookie', authService.buildSessionCookies(refreshed, {
      secure: authService.isSecureRequest(req),
    }));
    return { accessToken: refreshed.accessToken, user: refreshed.user, config };
  } catch (error) {
    if (error.code === 'UNAUTHENTICATED' && error.status === 401) {
      res.setHeader('Set-Cookie', authService.clearSessionCookies({ secure: authService.isSecureRequest(req) }));
    }
    throw error;
  }
}

function createSessionHandler({ authService }) {
  return async function sessionHandler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return res.status(405).json({ authenticated: false });
    }
    try {
      const { user } = await resolveRequestSession({ req, res, authService });
      return res.status(200).json({ authenticated: true, session: authService.toPublicSession(user) });
    } catch (error) {
      const status = error instanceof AuthServiceError ? error.status : 502;
      return res.status(status).json({ authenticated: false });
    }
  };
}

module.exports = { resolveRequestSession, createSessionHandler };
