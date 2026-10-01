// middleware.js
// Vercel Edge Middleware — se ejecuta ANTES de servir cualquier archivo estático
// o función serverless. Aquí es donde debe vivir el control de acceso real,
// nunca solo en el HTML/JS del navegador.
//
// Requiere: npm install jose
// (jose funciona en el Edge Runtime; jsonwebtoken/bcrypt NO funcionan ahí).

import { jwtVerify } from 'jose';
import authService from './lib/supabase-auth-service.cjs';
import requestSession from './lib/request-auth-session.cjs';

const COOKIE_NAME = 'invitta_session';
const PROFESSIONAL_COOKIE_NAME = 'invitta_access_token';

// Rutas que exigen una sesión válida. Ajusta esta lista según vayas
// migrando más paneles. Usa rutas exactas o prefijos con /*.
const PROTECTED_PATHS = [
  '/organizador-mesas.html',
  '/generador-emergencia.html',
  '/scanner-acceso.html',
  '/invitacion-estudio.html',
  '/catering-module', // prefijo: protege todo lo que cuelgue de esta carpeta
];

// Roles mínimos requeridos por ruta. "planner" y "designer" son roles más
// limitados que ya usas en tus links (?role=planner, ?role=designer);
// "host" es el rol de los novios (control total); "hostess" es el del
// escáner de puerta.
const ROUTE_ROLES = {
  '/organizador-mesas.html': ['host', 'planner'],
  '/generador-emergencia.html': ['host', 'hostess'],
  '/scanner-acceso.html': ['host', 'hostess'],
  '/invitacion-estudio.html': ['host', 'designer'],
  '/catering-module': ['host', 'planner'],
};

function isProtected(pathname) {
  return PROTECTED_PATHS.some((p) =>
    p.endsWith('.html') ? pathname === p : pathname.startsWith(p)
  );
}

function requiredRoles(pathname) {
  const key = Object.keys(ROUTE_ROLES).find((p) =>
    p.endsWith('.html') ? pathname === p : pathname.startsWith(p)
  );
  return key ? ROUTE_ROLES[key] : [];
}

function readCookie(request, name) {
  const entry = request.headers.get('cookie')?.split(';').find((part) =>
    part.trim().startsWith(`${name}=`)
  );
  if (!entry) return '';
  const value = entry.slice(entry.indexOf('=') + 1).trim();
  try { return decodeURIComponent(value); } catch (_) { return ''; }
}

async function professionalStudioAccess(request, onRevokedCookies) {
  if (!readCookie(request, PROFESSIONAL_COOKIE_NAME) && !readCookie(request, authService.REFRESH_COOKIE)) return false;
  let sessionCookies;
  try {
    if (new URL(authService.getAuthConfig().url).protocol !== 'https:') throw new Error('Auth configuration invalid');
    const { user } = await requestSession.resolveRequestSession({
      req: { headers: { cookie: request.headers.get('cookie'), 'x-forwarded-proto': new URL(request.url).protocol.slice(0, -1) } },
      res: { setHeader(name, value) { if (name === 'Set-Cookie') sessionCookies = value; } },
      authService,
    });
    const verified = typeof user.id === 'string' && user.id.length > 0 &&
      typeof user.email === 'string' && user.email.length > 0 && user.is_anonymous !== true;
    if (!verified) return false;
    if (!sessionCookies) return true;
    // A same-URL redirect lets the browser install the rotated cookies before
    // loading Studio and its parallel authenticated asset requests.
    const headers = new Headers({ Location: request.url, 'Cache-Control': 'private, no-store' });
    sessionCookies.forEach((cookie) => headers.append('Set-Cookie', cookie));
    return new Response(null, { status: 307, headers });
  } catch (error) {
    if (error.code === 'UNAUTHENTICATED' && error.status === 401) {
      if (sessionCookies) onRevokedCookies(sessionCookies);
      return false;
    }
    return new Response('No fue posible verificar la sesión. Intenta de nuevo en un momento.', {
      status: 503, headers: { 'Cache-Control': 'private, no-store' },
    });
  }
}

export default async function middleware(request) {
  const { pathname } = new URL(request.url);

  if (!isProtected(pathname)) {
    return; // deja pasar rutas públicas (index, portal, invitacion-boda, etc.)
  }

  // Studio usa la sesión profesional de Supabase. Los demás módulos
  // conservan sus permisos de evento y su cookie legacy independiente.
  let revokedCookies = [];
  if (pathname === '/invitacion-estudio.html') {
    const professionalAccess = await professionalStudioAccess(request, (cookies) => { revokedCookies = cookies; });
    if (professionalAccess === true) return;
    if (professionalAccess instanceof Response) return professionalAccess;
  }

  const token = readCookie(request, COOKIE_NAME);

  if (!token) {
    return redirectToLogin(request, pathname, revokedCookies);
  }

  try {
    const secret = new TextEncoder().encode(process.env.SESSION_JWT_SECRET || 'invitta-beta-fallback-secret-key-32-bytes-min');
    const { payload } = await jwtVerify(token, secret);

    // payload esperado: { sub: eventCode, role: 'host'|'planner'|'designer'|'hostess', exp }
    const roles = requiredRoles(pathname);
    if (roles.length && !roles.includes(payload.role)) {
      return new Response('403 · No autorizado para este módulo', { status: 403 });
    }

    // Sesión válida y rol correcto: deja pasar la petición tal cual.
    return;
  } catch (err) {
    // Token ausente, expirado o manipulado.
    return redirectToLogin(request, pathname, revokedCookies);
  }
}

function redirectToLogin(request, attemptedPath, revokedCookies = []) {
  const url = new URL('/portal.html', request.url);
  url.searchParams.set('login', 'required');
  url.searchParams.set('next', attemptedPath + new URL(request.url).search);
  const headers = new Headers({ Location: url.toString(), 'Cache-Control': 'private, no-store' });
  revokedCookies.forEach((cookie) => headers.append('Set-Cookie', cookie));
  return new Response(null, { status: 302, headers });
}

// Vercel solo invoca el middleware para rutas que coincidan con este matcher,
// así evitamos overhead en assets estáticos (css/js/imágenes).
export const config = {
  matcher: [
    '/organizador-mesas.html',
    '/generador-emergencia.html',
    '/scanner-acceso.html',
    '/invitacion-estudio.html',
    '/catering-module/:path*',
  ],
};
