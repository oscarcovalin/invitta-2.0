'use strict';
const { resolveRequestSession } = require('./request-auth-session.cjs');
const { OperationError } = require('./project-operations-store.cjs');
function assertOrigin(req, authService) {
  try {
    const host = req.headers?.host;
    const raw = req.headers?.origin;
    const protocol = authService.isSecureRequest(req) || req.socket?.encrypted ? 'https:' : 'http:';
    const expected = new URL(`${protocol}//${host}`);
    const origin = new URL(raw);
    if (typeof host !== 'string' || typeof raw !== 'string' || raw !== origin.origin ||
      origin.origin !== expected.origin || expected.host !== host || origin.username || origin.password) throw new Error();
  } catch (_) { throw new OperationError(403, 'FORBIDDEN_ORIGIN', 'La solicitud debe provenir de esta aplicación.'); }
}
function parseBody(body) {
  try {
    const serialized = typeof body === 'string' ? body : JSON.stringify(body);
    if (!serialized || Buffer.byteLength(serialized) > 8192) throw new Error();
    return typeof body === 'string' ? JSON.parse(body) : body;
  } catch (_) { throw new OperationError(422, 'INVALID_INPUT', 'El cuerpo de la solicitud no es válido.'); }
}
function createProjectOperationsHandler({ authService, operate, resource }) {
  return async function projectOperationsHandler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (!['GET', 'POST', 'PATCH'].includes(req.method)) {
      res.setHeader('Allow', 'GET, POST, PATCH');
      return res.status(405).json({ success: false, code: 'METHOD_NOT_ALLOWED', error: 'Método no permitido.' });
    }
    try {
      if (req.method !== 'GET') assertOrigin(req, authService);
      const { accessToken, user, config } = await resolveRequestSession({ req, res, authService });
      if (user.is_anonymous) throw new OperationError(403, 'FORBIDDEN', 'Se requiere una cuenta profesional.');
      const input = req.method === 'GET' ? Object.fromEntries(Object.entries(req.query || {}).filter(([key]) => key !== 'route')) : parseBody(req.body);
      const result = await operate({ resource, method: req.method, input, accessToken, userId: user.id, config });
      return res.status(req.method === 'POST' ? 201 : 200).json({ success: true, ...result });
    } catch (error) {
      const status = [401, 403, 404, 409, 422, 503].includes(error?.status) ? error.status : 502;
      const codes = { 401: 'UNAUTHENTICATED', 403: 'FORBIDDEN', 404: 'NOT_FOUND', 409: 'CONFLICT', 422: 'INVALID_INPUT', 503: 'NOT_CONFIGURED', 502: 'STORE_UNAVAILABLE' };
      const messages = { 401: 'Inicia sesión de nuevo.', 503: 'El servicio no está configurado.' };
      return res.status(status).json({ success: false, code: error instanceof OperationError ? error.code : codes[status],
        error: error instanceof OperationError ? error.message : messages[status] || 'No fue posible confirmar la operación. Conserva tus cambios y verifica el estado.' });
    }
  };
}
module.exports = { createProjectOperationsHandler, assertOrigin, parseBody };
