import authService from '../../lib/supabase-auth-service.cjs';

const { AuthServiceError, buildSessionCookies, getAuthConfig, isSecureRequest, registerProfessionalAccount, toPublicSession } = authService;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false, error: 'Método no permitido.' });
  }
  res.setHeader('Cache-Control', 'no-store');
  try {
    const result = await registerProfessionalAccount({
      email: req.body?.email,
      password: req.body?.password,
      config: getAuthConfig(),
    });
    if (result.session) {
      res.setHeader('Set-Cookie', buildSessionCookies(result.session, { secure: isSecureRequest(req) }));
    }
    return res.status(201).json({
      success: true,
      confirmationRequired: !result.session,
      session: result.session ? toPublicSession(result.user) : undefined,
      message: result.session
        ? 'Cuenta creada. Ya puedes iniciar sesión.'
        : 'Si el correo puede registrarse, recibirás un mensaje para verificarlo y terminar el alta.',
    });
  } catch (error) {
    if (error instanceof AuthServiceError) return res.status(error.status).json({ success: false, error: error.message });
    console.error('[Auth] Professional account registration failed unexpectedly.');
    return res.status(502).json({ success: false, error: 'No fue posible procesar el alta.' });
  }
}
