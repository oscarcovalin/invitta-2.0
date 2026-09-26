import authService from '../lib/supabase-auth-service.cjs';

const { AuthServiceError, authenticateWithPassword, buildSessionCookies, getAuthConfig, isSecureRequest, toPublicSession } = authService;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false, error: 'Método no permitido.' });
  }
  const { username, email, password } = req.body || {};
  const identity = email || username;
  if (!identity || !password) {
    return res.status(400).json({ success: false, error: 'Ingresa tu correo y contraseña.' });
  }
  try {
    const authenticated = await authenticateWithPassword({ email: identity, password, config: getAuthConfig() });
    const session = toPublicSession(authenticated.user);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Set-Cookie', buildSessionCookies(authenticated, { secure: isSecureRequest(req) }));
    return res.status(200).json({ success: true, session, redirectUrl: 'portal.html' });
  } catch (error) {
    if (error instanceof AuthServiceError) {
      return res.status(error.status).json({ success: false, error: error.message });
    }
    console.error('[Auth] Supabase sign-in failed unexpectedly.');
    return res.status(502).json({ success: false, error: 'No fue posible iniciar sesión.' });
  }
}
