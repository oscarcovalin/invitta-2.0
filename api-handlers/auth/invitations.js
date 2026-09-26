import authService from '../../lib/supabase-auth-service.cjs';

const { ACCESS_COOKIE, AuthServiceError, getAuthConfig, getAuthenticatedUser, inviteProfessionalUser, isPlatformAdmin, parseCookies } = authService;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false, error: 'Método no permitido.' });
  }
  res.setHeader('Cache-Control', 'no-store');
  const config = getAuthConfig();
  try {
    const accessToken = parseCookies(req.headers.cookie)[ACCESS_COOKIE];
    const user = await getAuthenticatedUser({ accessToken, config });
    if (!isPlatformAdmin(user)) {
      return res.status(403).json({ success: false, error: 'Sólo un administrador de plataforma puede invitar cuentas.' });
    }
    const invited = await inviteProfessionalUser({ email: req.body?.email, accessToken, config });
    return res.status(201).json({ success: true, invited });
  } catch (error) {
    if (error instanceof AuthServiceError) return res.status(error.status).json({ success: false, error: error.message });
    console.error('[Auth] Professional invitation failed unexpectedly.');
    return res.status(502).json({ success: false, error: 'No fue posible enviar la invitación.' });
  }
}
