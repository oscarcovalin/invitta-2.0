import { SignJWT } from 'jose';
import bcrypt from 'bcryptjs';
import { rateLimiter } from '../lib/rateLimit.js';

const COOKIE_NAME = 'invitta_session';
const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12 horas

const EVENTS = {
  'CATALINA-JULIAN': {
    pinHash: process.env.EVENT_CATALINA_JULIAN_PIN_HASH || '$2b$10$gSwoqNwOMCXzA/Feox2UgeWK.XIpA/f17VnOKAqrIY0HNxbiHlfK2',
    role: 'host',
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const { eventCode, pin } = req.body ?? {};

  if (!eventCode || !pin) {
    return res.status(400).json({ error: 'Faltan campos requeridos' });
  }

  const ip = req.headers['x-forwarded-for'] || req.connection?.remoteAddress || '127.0.0.1';
  const identifier = `${ip}:${String(eventCode).toUpperCase()}`;

  if (process.env.UPSTASH_REDIS_REST_URL) {
    try {
      const { success, limit, reset, remaining } = await rateLimiter.limit(identifier);
      res.setHeader('X-RateLimit-Limit', limit);
      res.setHeader('X-RateLimit-Remaining', remaining);
      res.setHeader('X-RateLimit-Reset', reset);
      if (!success) {
        return res.status(429).json({ error: 'Demasiados intentos. Intenta más tarde.' });
      }
    } catch (err) {
      console.error('RateLimit error:', err);
      // Fall open if redis is unreachable so users can still login
    }
  }

  const event = EVENTS[String(eventCode).toUpperCase()];

  const genericError = () =>
    res.status(401).json({ error: 'Código o PIN incorrecto' });

  if (!event || !event.pinHash) {
    return genericError();
  }

  const pinMatches = await bcrypt.compare(String(pin), event.pinHash);
  if (!pinMatches) {
    return genericError();
  }

  const secret = new TextEncoder().encode(process.env.SESSION_JWT_SECRET || 'invitta-beta-fallback-secret-key-32-bytes-min');
  const token = await new SignJWT({ role: event.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(eventCode.toUpperCase())
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secret);

  res.setHeader(
    'Set-Cookie',
    [
      `${COOKIE_NAME}=${token}`,
      'Path=/',
      'HttpOnly',
      'Secure',
      'SameSite=Strict',
      `Max-Age=${SESSION_TTL_SECONDS}`,
    ].join('; ')
  );

  return res.status(200).json({ ok: true, role: event.role });
}
