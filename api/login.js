// api/login.js
// Función serverless de Node (NO Edge) — aquí sí puedes usar bcrypt.
// Recibe { eventCode, pin } o { email, password } desde los formularios que
// ya existen en portal.html, valida contra tu base de datos real (o contra
// variables de entorno mientras migras), y si es correcto emite una cookie
// httpOnly firmada. El navegador nunca ve ni valida el PIN por su cuenta.
//
// Requiere: npm install jose bcryptjs

import { SignJWT } from 'jose';
import bcrypt from 'bcryptjs';

const COOKIE_NAME = 'invitta_session';
const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12 horas

// -----------------------------------------------------------------------
// TEMPORAL: mientras no tengas base de datos, guarda aquí (o mejor, en
// variables de entorno de Vercel) el hash del PIN por evento. NUNCA el PIN
// en texto plano. Genera el hash una vez con:
//   node -e "console.log(require('bcryptjs').hashSync('1234', 10))"
// -----------------------------------------------------------------------
const EVENTS = {
  'CATALINA-JULIAN': {
    pinHash: process.env.EVENT_CATALINA_JULIAN_PIN_HASH, // desde Vercel env vars
    role: 'host',
  },
  // agrega más eventos aquí, o reemplaza este objeto por una consulta real
  // a tu base de datos (Postgres, Supabase, etc.)
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

  const event = EVENTS[String(eventCode).toUpperCase()];

  // Importante: responde con el MISMO mensaje genérico si el evento no
  // existe o si el PIN es incorrecto, para no filtrar qué códigos son
  // válidos (evita enumeración de eventos).
  const genericError = () =>
    res.status(401).json({ error: 'Código o PIN incorrecto' });

  if (!event || !event.pinHash) {
    return genericError();
  }

  const pinMatches = await bcrypt.compare(String(pin), event.pinHash);
  if (!pinMatches) {
    return genericError();
  }

  const secret = new TextEncoder().encode(process.env.SESSION_JWT_SECRET);
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
