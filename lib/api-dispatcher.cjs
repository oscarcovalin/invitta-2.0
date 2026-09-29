'use strict';

const ROUTE_KEYS = Object.freeze([
  'auth', 'auth/invitations', 'auth/recover', 'auth/register', 'checkout', 'invitacion/create', 'invitacion/token', 'login', 'logout',
  'payment-config', 'projects/asset', 'projects/create', 'projects/get',
  'projects/latest-revision', 'projects/list', 'projects/publication-preview',
  'projects/publish-revision', 'projects/save-revision', 'projects/upload-asset',
  'public/image', 'public/invitation', 'public/review', 'public/review-media', 'public/share-preview', 'session', 'webhooks/clip',
  'webhooks/mercadopago', 'webhooks/stripe',
]);

function normalizeRoute(value) {
  if (Array.isArray(value)) return null;
  if (typeof value !== 'string') return null;
  const route = value.replace(/^\/+|\/+$/g, '');
  if (!route || route.includes('\\') || route.includes('\0') || route.split('/').some((part) => !part || part === '.' || part === '..')) return null;
  return route;
}

function createApiDispatcher({ handlers }) {
  const allowed = new Set(ROUTE_KEYS);
  return async function dispatch(req, res) {
    const route = normalizeRoute(req.query && req.query.route);
    if (!route || !allowed.has(route) || typeof handlers[route] !== 'function') {
      return res.status(404).json({ success: false, error: 'Ruta no encontrada.' });
    }
    return handlers[route](req, res);
  };
}

module.exports = { ROUTE_KEYS, createApiDispatcher, normalizeRoute };
