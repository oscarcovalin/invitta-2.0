import dispatcher from '../lib/api-dispatcher.cjs';
import auth from '../api-handlers/auth.js';
import checkout from '../api-handlers/checkout.cjs';
import invitationCreate from '../api-handlers/invitacion/create.js';
import invitationToken from '../api-handlers/invitacion/token.js';
import login from '../api-handlers/login.js';
import logout from '../api-handlers/logout.js';
import paymentConfig from '../api-handlers/payment-config.cjs';
import projectAsset from '../api-handlers/projects/asset.js';
import projectCreate from '../api-handlers/projects/create.js';
import projectGet from '../api-handlers/projects/get.js';
import latestRevision from '../api-handlers/projects/latest-revision.js';
import projectList from '../api-handlers/projects/list.js';
import publicationPreview from '../api-handlers/projects/publication-preview.js';
import publishRevision from '../api-handlers/projects/publish-revision.js';
import saveRevision from '../api-handlers/projects/save-revision.js';
import uploadAsset from '../api-handlers/projects/upload-asset.js';
import publicImage from '../api-handlers/public/image.js';
import publicInvitation from '../api-handlers/public/invitation.js';
import session from '../api-handlers/session.js';
import clipWebhook from '../api-handlers/webhooks/clip.cjs';
import mercadoPagoWebhook from '../api-handlers/webhooks/mercadopago.cjs';
import stripeWebhook from '../api-handlers/webhooks/stripe.cjs';

const handler = dispatcher.createApiDispatcher({
  handlers: {
    auth, checkout,
    'invitacion/create': invitationCreate,
    'invitacion/token': invitationToken,
    login, logout, 'payment-config': paymentConfig,
    'projects/asset': projectAsset,
    'projects/create': projectCreate,
    'projects/get': projectGet,
    'projects/latest-revision': latestRevision,
    'projects/list': projectList,
    'projects/publication-preview': publicationPreview,
    'projects/publish-revision': publishRevision,
    'projects/save-revision': saveRevision,
    'projects/upload-asset': uploadAsset,
    'public/image': publicImage,
    'public/invitation': publicInvitation,
    session,
    'webhooks/clip': clipWebhook,
    'webhooks/mercadopago': mercadoPagoWebhook,
    'webhooks/stripe': stripeWebhook,
  },
});

export default handler;
