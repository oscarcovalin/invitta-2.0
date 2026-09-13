// middleware.js
// Vercel Edge Middleware — se ejecuta ANTES de servir cualquier archivo estático
// o función serverless. Aquí es donde debe vivir el control de acceso real,
// nunca solo en el HTML/JS del navegador.
//
// Requiere: npm install jose
// (jose funciona en el Edge Runtime; jsonwebtoken/bcrypt NO funcionan ahí).

import { jwtVerify } from 'jose';

const COOKIE_NAME = 'invitta_session';

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

export default async function middleware(request) {
  const { pathname } = new URL(request.url);

  if (!isProtected(pathname)) {
    return; // deja pasar rutas públicas (index, portal, invitacion-boda, etc.)
  }

  const token = request.headers.get('cookie')?.split(';').find(c => c.trim().startsWith(COOKIE_NAME + '='))?.split('=')[1];

  if (!token) {
    return redirectToLogin(request, pathname);
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
    return redirectToLogin(request, pathname);
  }
}

function redirectToLogin(request, attemptedPath) {
  const url = new URL('/portal.html', request.url);
  url.searchParams.set('login', 'required');
  url.searchParams.set('next', attemptedPath);
  return Response.redirect(url, 302);
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
