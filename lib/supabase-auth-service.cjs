'use strict';

const ACCESS_COOKIE = 'invitta_access_token';
const REFRESH_COOKIE = 'invitta_refresh_token';
const REFRESH_MAX_AGE_SECONDS = 60 * 60 * 24 * 400;

class AuthServiceError extends Error {
  constructor(code, message, status = 500) {
    super(message);
    this.name = 'AuthServiceError';
    this.code = code;
    this.status = status;
  }
}

function getAuthConfig(env = process.env) {
  return {
    url: String(env.SUPABASE_URL || '').replace(/\/$/, ''),
    publishableKey: env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY || '',
  };
}

function assertConfig(config) {
  if (!config || !config.url || !config.publishableKey) {
    throw new AuthServiceError('AUTH_NOT_CONFIGURED', 'La autenticación no está configurada.', 503);
  }
}

async function readJson(response) {
  try { return await response.json(); } catch (_) { return {}; }
}

async function authenticateWithPassword({ email, password, config, fetchImpl = fetch }) {
  assertConfig(config);
  const response = await fetchImpl(`${config.url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: config.publishableKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: String(email).trim().toLowerCase(), password: String(password) }),
  });
  const payload = await readJson(response);
  if (!response.ok || !payload.access_token || !payload.refresh_token || !payload.user) {
    throw new AuthServiceError('INVALID_CREDENTIALS', 'Credenciales inválidas.', 401);
  }
  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    expiresIn: Number(payload.expires_in) || 3600,
    user: payload.user,
  };
}

async function refreshAuthSession({ refreshToken, config, fetchImpl = fetch }) {
  assertConfig(config);
  if (!refreshToken) throw new AuthServiceError('UNAUTHENTICATED', 'Sesión no válida.', 401);
  const response = await fetchImpl(`${config.url}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: { apikey: config.publishableKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  const payload = await readJson(response);
  if (!response.ok || !payload.access_token || !payload.refresh_token || !payload.user) {
    throw new AuthServiceError('UNAUTHENTICATED', 'Sesión no válida.', 401);
  }
  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    expiresIn: Number(payload.expires_in) || 3600,
    user: payload.user,
  };
}

async function revokeAuthSession({ accessToken, config, fetchImpl = fetch }) {
  assertConfig(config);
  if (!accessToken) return;
  const response = await fetchImpl(`${config.url}/auth/v1/logout?scope=local`, {
    method: 'POST',
    headers: { apikey: config.publishableKey, Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new AuthServiceError('SIGN_OUT_FAILED', 'No fue posible revocar la sesión.', 502);
}

async function getAuthenticatedUser({ accessToken, config, fetchImpl = fetch }) {
  assertConfig(config);
  if (!accessToken) throw new AuthServiceError('UNAUTHENTICATED', 'Sesión no válida.', 401);
  const response = await fetchImpl(`${config.url}/auth/v1/user`, {
    method: 'GET',
    headers: { apikey: config.publishableKey, Authorization: `Bearer ${accessToken}` },
  });
  const user = await readJson(response);
  if (!response.ok || !user.id) throw new AuthServiceError('UNAUTHENTICATED', 'Sesión no válida.', 401);
  return user;
}

function toPublicSession(user) {
  const isAdmin = user && user.app_metadata && user.app_metadata.platform_role === 'platform_admin';
  return { userId: user.id, email: user.email || null, role: isAdmin ? 'platform_admin' : 'member' };
}

function serializeCookie(name, value, { maxAge, secure }) {
  const attributes = [
    `${name}=${encodeURIComponent(value)}`, 'Path=/', 'HttpOnly', 'SameSite=Lax',
    `Max-Age=${Math.max(0, Math.floor(maxAge))}`,
  ];
  if (secure) attributes.push('Secure');
  return attributes.join('; ');
}

function buildSessionCookies(session, { secure = true } = {}) {
  return [
    serializeCookie(ACCESS_COOKIE, session.accessToken, { maxAge: session.expiresIn, secure }),
    serializeCookie(REFRESH_COOKIE, session.refreshToken, { maxAge: REFRESH_MAX_AGE_SECONDS, secure }),
  ];
}

function clearSessionCookies({ secure = true } = {}) {
  return [
    serializeCookie(ACCESS_COOKIE, '', { maxAge: 0, secure }),
    serializeCookie(REFRESH_COOKIE, '', { maxAge: 0, secure }),
  ];
}

function parseCookies(header = '') {
  return String(header).split(';').reduce((cookies, part) => {
    const separator = part.indexOf('=');
    if (separator < 0) return cookies;
    const name = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (!name) return cookies;
    try { cookies[name] = decodeURIComponent(value); } catch (_) { cookies[name] = value; }
    return cookies;
  }, {});
}

function isSecureRequest(req) {
  const forwarded = String(req && req.headers && req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  return process.env.NODE_ENV === 'production' || forwarded === 'https';
}

module.exports = {
  ACCESS_COOKIE, REFRESH_COOKIE, AuthServiceError, authenticateWithPassword,
  buildSessionCookies, clearSessionCookies, getAuthConfig, getAuthenticatedUser,
  isSecureRequest, parseCookies, refreshAuthSession, revokeAuthSession, toPublicSession,
};
