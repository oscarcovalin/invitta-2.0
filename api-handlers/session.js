import authService from '../lib/supabase-auth-service.cjs';

const {
  ACCESS_COOKIE, REFRESH_COOKIE, buildSessionCookies, clearSessionCookies, getAuthConfig,
  getAuthenticatedUser, isSecureRequest, parseCookies, refreshAuthSession, toPublicSession,
} = authService;

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ authenticated: false });
  }
  res.setHeader('Cache-Control', 'no-store');
  const cookies = parseCookies(req.headers.cookie);
  const config = getAuthConfig();
  try {
    const user = await getAuthenticatedUser({ accessToken: cookies[ACCESS_COOKIE], config: getAuthConfig() });
    return res.status(200).json({ authenticated: true, session: toPublicSession(user) });
  } catch (_) {
    try {
      const refreshed = await refreshAuthSession({ refreshToken: cookies[REFRESH_COOKIE], config });
      res.setHeader('Set-Cookie', buildSessionCookies(refreshed, { secure: isSecureRequest(req) }));
      return res.status(200).json({ authenticated: true, session: toPublicSession(refreshed.user) });
    } catch (_) {
      res.setHeader('Set-Cookie', clearSessionCookies({ secure: isSecureRequest(req) }));
      return res.status(401).json({ authenticated: false });
    }
  }
}
