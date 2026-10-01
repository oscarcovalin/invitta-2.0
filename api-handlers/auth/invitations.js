import authService from '../../lib/supabase-auth-service.cjs';
import requestSession from '../../lib/request-auth-session.cjs';

const { AuthServiceError, inviteProfessionalUser, isPlatformAdmin } = authService;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false, error: 'Método no permitido.' });
  }
  res.setHeader('Cache-Control', 'no-store');
  try {
    const { accessToken, user, config } = await requestSession.resolveRequestSession({ req, res, authService });
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
