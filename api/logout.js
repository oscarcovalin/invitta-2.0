import authService from '../lib/supabase-auth-service.cjs';

const { ACCESS_COOKIE, clearSessionCookies, getAuthConfig, isSecureRequest, parseCookies, revokeAuthSession } = authService;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false });
  }
  const cookies = parseCookies(req.headers.cookie);
  try {
    await revokeAuthSession({ accessToken: cookies[ACCESS_COOKIE], config: getAuthConfig() });
  } catch (_) {
    // Clearing local cookies is mandatory even if Supabase is temporarily unavailable.
  }
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Set-Cookie', clearSessionCookies({ secure: isSecureRequest(req) }));
  return res.status(200).json({ ok: true });
}
