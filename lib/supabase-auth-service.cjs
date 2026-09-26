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
    secretKey: env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY || '',
    authRedirectUrl: String(env.INVITTA_AUTH_REDIRECT_URL || '').trim(),
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

function normalizeEmail(email) {
  const normalized = String(email || '').trim().toLowerCase();
  if (normalized.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new AuthServiceError('INVALID_EMAIL', 'Escribe un correo electrónico válido.', 400);
  }
  return normalized;
}

async function inviteProfessionalUser({ email, accessToken, config, fetchImpl = fetch }) {
  assertConfig(config);
  if (!accessToken) throw new AuthServiceError('UNAUTHENTICATED', 'Inicia sesión como administrador para invitar cuentas.', 401);
  if (!config.secretKey) throw new AuthServiceError('AUTH_NOT_CONFIGURED', 'El envío de invitaciones no está configurado todavía.', 503);
  const normalizedEmail = normalizeEmail(email);
  const inviteUrl = new URL(`${config.url}/auth/v1/invite`);
  if (config.authRedirectUrl) inviteUrl.searchParams.set('redirect_to', config.authRedirectUrl);
  const response = await fetchImpl(inviteUrl.toString(), {
    method: 'POST',
    headers: { apikey: config.secretKey, Authorization: `Bearer ${config.secretKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: normalizedEmail, data: { platform_role: 'member' } }),
  });
  const user = await readJson(response);
  if (!response.ok || !user.id) {
    if (response.status === 429) throw new AuthServiceError('RATE_LIMITED', 'Demasiadas invitaciones. Espera un momento y vuelve a intentar.', 429);
    throw new AuthServiceError('INVITE_FAILED', 'No fue posible invitar esta cuenta. Verifica el correo o si ya está registrada.', response.status >= 500 ? 502 : 400);
  }
  return { id: user.id, email: user.email || normalizedEmail };
}

async function registerProfessionalAccount({ email, password, config, fetchImpl = fetch }) {
  assertConfig(config);
  const normalizedEmail = normalizeEmail(email);
  const normalizedPassword = String(password || '');
  if (normalizedPassword.length < 12 || normalizedPassword.length > 128) {
    throw new AuthServiceError('INVALID_PASSWORD', 'La contraseña debe tener entre 12 y 128 caracteres.', 400);
  }
  const signupUrl = new URL(`${config.url}/auth/v1/signup`);
  if (config.authRedirectUrl) signupUrl.searchParams.set('redirect_to', config.authRedirectUrl);
  const response = await fetchImpl(signupUrl.toString(), {
    method: 'POST',
    headers: { apikey: config.publishableKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: normalizedEmail, password: normalizedPassword }),
  });
  const payload = await readJson(response);
  if (!response.ok) {
    if (response.status === 429) throw new AuthServiceError('RATE_LIMITED', 'Demasiados intentos. Espera un momento y vuelve a intentar.', 429);
    throw new AuthServiceError('SIGNUP_FAILED', 'No fue posible crear la cuenta. Verifica el correo o si ya existe.', response.status >= 500 ? 502 : 400);
  }
  const user = payload.user || payload;
  if (!user.id) throw new AuthServiceError('SIGNUP_FAILED', 'No fue posible crear la cuenta.', 502);
  return {
    user,
    session: payload.access_token && payload.refresh_token ? {
      accessToken: payload.access_token,
      refreshToken: payload.refresh_token,
      expiresIn: Number(payload.expires_in) || 3600,
      user,
    } : null,
  };
}

async function requestPasswordRecovery({ email, config, fetchImpl = fetch }) {
  assertConfig(config);
  const normalizedEmail = normalizeEmail(email);
  const recoveryUrl = new URL(`${config.url}/auth/v1/recover`);
  if (config.authRedirectUrl) recoveryUrl.searchParams.set('redirect_to', config.authRedirectUrl);
  const response = await fetchImpl(recoveryUrl.toString(), {
    method: 'POST',
    headers: { apikey: config.publishableKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: normalizedEmail }),
  });
  if (!response.ok) throw new AuthServiceError('RECOVERY_FAILED', 'No fue posible enviar el enlace. Intenta de nuevo más tarde.', response.status === 429 ? 429 : 502);
}

async function confirmPasswordRecovery({ accessToken, newPassword, config, fetchImpl = fetch }) {
  assertConfig(config);
  const password = String(newPassword || '');
  if (!accessToken) throw new AuthServiceError('UNAUTHENTICATED', 'Abre el enlace de recuperación recibido por correo.', 401);
  if (password.length < 12 || password.length > 128) {
    throw new AuthServiceError('INVALID_PASSWORD', 'La contraseña debe tener entre 12 y 128 caracteres.', 400);
  }
  const response = await fetchImpl(`${config.url}/auth/v1/user`, {
    method: 'PUT',
    headers: { apikey: config.publishableKey, Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  const user = await readJson(response);
  if (!response.ok || !user.id) throw new AuthServiceError('RECOVERY_FAILED', 'El enlace venció o no se pudo cambiar la contraseña. Solicita otro.', 400);
  return { id: user.id };
}

function isPlatformAdmin(user) {
  return user?.app_metadata?.platform_role === 'platform_admin';
}

function toPublicSession(user, env = process.env) {
  const isAdmin = isPlatformAdmin(user, env);
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
  ACCESS_COOKIE, REFRESH_COOKIE, AuthServiceError, authenticateWithPassword, isPlatformAdmin,
  buildSessionCookies, clearSessionCookies, confirmPasswordRecovery, getAuthConfig, getAuthenticatedUser,
  inviteProfessionalUser, normalizeEmail, requestPasswordRecovery,
  registerProfessionalAccount,
  isSecureRequest, parseCookies, refreshAuthSession, revokeAuthSession, toPublicSession,
};
