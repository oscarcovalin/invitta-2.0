import authService from '../../lib/supabase-auth-service.cjs';

const { ACCESS_COOKIE, REFRESH_COOKIE, AuthServiceError, confirmPasswordRecovery, getAuthConfig, isSecureRequest, parseCookies, requestPasswordRecovery } = authService;

async function exchangeRecoveryTokens({ accessToken, refreshToken, config, res, secure }) {
  if (!accessToken || !refreshToken) throw new AuthServiceError('INVALID_RECOVERY_LINK', 'El enlace de recuperación no es válido.', 400);
  if (typeof accessToken !== 'string' || accessToken.length > 4096 || typeof refreshToken !== 'string' || refreshToken.length > 4096) {
    throw new AuthServiceError('INVALID_RECOVERY_LINK', 'El enlace de recuperación no es válido.', 400);
  }
  const verified = await fetch(`${config.url}/auth/v1/user`, {
    method: 'GET',
    headers: { apikey: config.publishableKey, Authorization: `Bearer ${accessToken}` },
  });
  if (!verified.ok) throw new AuthServiceError('INVALID_RECOVERY_LINK', 'El enlace venció o no es válido. Solicita otro.', 400);
  res.setHeader('Set-Cookie', [
    `${ACCESS_COOKIE}=${encodeURIComponent(accessToken)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=3600${secure ? '; Secure' : ''}`,
    `${REFRESH_COOKIE}=${encodeURIComponent(refreshToken)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=34560000${secure ? '; Secure' : ''}`,
  ]);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false, error: 'Método no permitido.' });
  }
  res.setHeader('Cache-Control', 'no-store');
  const config = getAuthConfig();
  try {
    if (req.body?.action === 'exchange') {
      await exchangeRecoveryTokens({ accessToken: req.body.accessToken, refreshToken: req.body.refreshToken, config, res, secure: isSecureRequest(req) });
      return res.status(200).json({ success: true });
    }
    if (req.body?.action === 'verify') {
      if (!['recovery', 'invite', 'signup'].includes(req.body.type) || typeof req.body.tokenHash !== 'string' || req.body.tokenHash.length < 20 || req.body.tokenHash.length > 512) {
        throw new AuthServiceError('INVALID_RECOVERY_LINK', 'El enlace de recuperación no es válido.', 400);
      }
      const response = await fetch(`${config.url}/auth/v1/verify`, {
        method: 'POST',
        headers: { apikey: config.publishableKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ token_hash: req.body.tokenHash, type: req.body.type }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.access_token || !payload.refresh_token) throw new AuthServiceError('INVALID_RECOVERY_LINK', 'El enlace venció o no es válido. Solicita otro.', 400);
      await exchangeRecoveryTokens({ accessToken: payload.access_token, refreshToken: payload.refresh_token, config, res, secure: isSecureRequest(req) });
      return res.status(200).json({ success: true });
    }
    if (req.body?.action === 'complete') {
      const accessToken = parseCookies(req.headers.cookie)[ACCESS_COOKIE];
      await confirmPasswordRecovery({ accessToken, newPassword: req.body.password, config });
      return res.status(200).json({ success: true, message: 'Contraseña actualizada. Ya puedes iniciar sesión.' });
    }
    await requestPasswordRecovery({ email: req.body?.email, config });
    return res.status(200).json({ success: true, message: 'Si el correo está registrado, recibirás un enlace para cambiar la contraseña.' });
  } catch (error) {
    if (error instanceof AuthServiceError) return res.status(error.status).json({ success: false, error: error.message });
    console.error('[Auth] Password recovery failed unexpectedly.');
    return res.status(502).json({ success: false, error: 'No fue posible procesar la recuperación.' });
  }
}
