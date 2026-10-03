// api/invitacion/create.js
import { jwtVerify, SignJWT } from 'jose';

const COOKIE_NAME = 'invitta_session';
const INVITE_TTL_SECONDS = 60 * 60 * 24 * 120; // 120 días, suficiente para la boda

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const sessionToken = parseCookie(req.headers.cookie, COOKIE_NAME);
  if (!sessionToken) {
    return res.status(401).json({ error: 'No autenticado' });
  }

  try {
    const sessionSecret = new TextEncoder().encode(process.env.SESSION_JWT_SECRET);
    const { payload: session } = await jwtVerify(sessionToken, sessionSecret);
    if (!['host', 'planner', 'superadmin', 'host_premium'].includes(session.role)) {
      return res.status(403).json({ error: 'No autorizado' });
    }
  } catch (err) {
    return res.status(401).json({ error: 'Sesión inválida o vencida' });
  }

  const { folio } = req.body ?? {};
  if (!folio) {
    return res.status(400).json({ error: 'Falta el folio' });
  }

  const inviteSecret = new TextEncoder().encode(process.env.INVITE_JWT_SECRET);
  const token = await new SignJWT({ folio })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${INVITE_TTL_SECONDS}s`)
    .sign(inviteSecret);

  const siteUrl = (process.env.PUBLIC_SITE_URL || 'https://invitta-2-0.vercel.app').replace(/\/$/, '');
  const link = `${siteUrl}/invitacion-boda.html?t=${token}`;
  return res.status(200).json({ folio, link });
}

function parseCookie(header, name) {
  if (!header) return null;
  const match = header
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${name}=`));
  return match ? match.split('=')[1] : null;
}
