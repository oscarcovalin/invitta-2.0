import dispatcher from '../lib/api-dispatcher.cjs';

function lazy(importHandler) {
  return async (req, res) => {
    const imported = await importHandler();
    const handler = imported.default || imported;
    return handler(req, res);
  };
}

const handler = dispatcher.createApiDispatcher({
  handlers: {
    auth: lazy(() => import('../api-handlers/auth.js')),
    'auth/register': lazy(() => import('../api-handlers/auth/register.js')),
    'auth/recover': lazy(() => import('../api-handlers/auth/recover.js')),
    'auth/invitations': lazy(() => import('../api-handlers/auth/invitations.js')),
    checkout: lazy(() => import('../api-handlers/checkout.cjs')),
    'invitacion/create': lazy(() => import('../api-handlers/invitacion/create.js')),
    'invitacion/token': lazy(() => import('../api-handlers/invitacion/token.js')),
    login: lazy(() => import('../api-handlers/login.js')),
    logout: lazy(() => import('../api-handlers/logout.js')),
    'payment-config': lazy(() => import('../api-handlers/payment-config.cjs')),
    'projects/asset': lazy(() => import('../api-handlers/projects/asset.js')),
    'projects/create': lazy(() => import('../api-handlers/projects/create.js')),
    'projects/get': lazy(() => import('../api-handlers/projects/get.js')),
    'projects/latest-revision': lazy(() => import('../api-handlers/projects/latest-revision.js')),
    'projects/list': lazy(() => import('../api-handlers/projects/list.js')),
    'projects/publication-preview': lazy(() => import('../api-handlers/projects/publication-preview.js')),
    'projects/rsvps': lazy(() => import('../api-handlers/projects/rsvps.js')),
    'projects/publish-revision': lazy(() => import('../api-handlers/projects/publish-revision.js')),
    'projects/save-revision': lazy(() => import('../api-handlers/projects/save-revision.js')),
    'projects/upload-asset': lazy(() => import('../api-handlers/projects/upload-asset.js')),
    'public/image': lazy(() => import('../api-handlers/public/image.js')),
    'public/invitation': lazy(() => import('../api-handlers/public/invitation.js')),
    'public/review': lazy(() => import('../api-handlers/public/review.js')),
    'public/review-media': lazy(() => import('../api-handlers/public/review-media.js')),
    'public/rsvp': lazy(() => import('../api-handlers/public/rsvp.js')),
    'public/share-preview': lazy(() => import('../api-handlers/public/share-preview.js')),
    session: lazy(() => import('../api-handlers/session.js')),
    'webhooks/clip': lazy(() => import('../api-handlers/webhooks/clip.cjs')),
    'webhooks/mercadopago': lazy(() => import('../api-handlers/webhooks/mercadopago.cjs')),
    'webhooks/stripe': lazy(() => import('../api-handlers/webhooks/stripe.cjs')),
  },
});

export default handler;
