const assert = require('node:assert/strict');
const { projectPublicInvitation } = require('./lib/public-invitation-projection.cjs');

const document = {
  schemaVersion: 1,
  projectId: 'private-project',
  revision: 3,
  event: { type: 'wedding', startsAt: '2027-05-01T18:00:00-06:00', timeZone: 'America/Mexico_City', internalNote: 'SECRET_EVENT' },
  content: { title: 'Ana y Luis', welcomeMessage: 'Bienvenidos', internalNote: 'SECRET_CONTENT' },
  design: { theme: 'vino', internalNote: 'SECRET_DESIGN' },
  sections: [{ id: 'giftRegistry', enabled: true, settings: { internalNote: 'SECRET_SETTINGS' } }, { id: 'lodging', enabled: true }, { id: 'sharedAlbum', enabled: true }],
  assets: { hero: { storagePath: 'private/hero.webp' } },
  legacy: { config: {
    giftRegistry: { bank: { bankName: 'Banco', holder: 'Ana', clabe: '123456789012345678', secret: 'SECRET_BANK' } },
    whatsappNumber: '5215550001111',
    whatsappHosts: [{ label: 'Ana', phone: '5215550002222', secret: 'SECRET_HOST' }],
    lodging: { hotels: [{ name: 'Hotel', code: 'FIESTA', secret: 'SECRET_HOTEL' }] },
    sharedAlbum: { accessCode: 'ALBUM', secret: 'SECRET_ALBUM' },
    rsvpWebhookUrl: 'SECRET_WEBHOOK',
    defaultPassCount: 99,
    guests: ['SECRET_GUEST'],
  } },
};

const result = projectPublicInvitation(document);
assert.deepEqual(result, {
  schemaVersion: 1,
  event: { type: 'wedding', startsAt: '2027-05-01T18:00:00-06:00', timeZone: 'America/Mexico_City' },
  content: { title: 'Ana y Luis', welcomeMessage: 'Bienvenidos' },
  design: { theme: 'vino' },
  sections: [{ id: 'giftRegistry', enabled: true }, { id: 'lodging', enabled: true }, { id: 'sharedAlbum', enabled: true }],
  giftRegistry: { bank: { bankName: 'Banco', holder: 'Ana', clabe: '123456789012345678' } },
  whatsappNumber: '5215550001111',
  whatsappHosts: [{ label: 'Ana', phone: '5215550002222' }],
  lodging: { hotels: [{ name: 'Hotel', code: 'FIESTA' }] },
  sharedAlbum: { accessCode: 'ALBUM' },
});
assert.equal(JSON.stringify(result).includes('SECRET_'), false);
assert.equal(JSON.stringify(result).includes('private/hero.webp'), false);
assert.equal(JSON.stringify(result).includes('defaultPassCount'), false);

const hidden = structuredClone(document);
hidden.sections = [{ id: 'giftRegistry', enabled: false }, { id: 'lodging', enabled: false }, { id: 'sharedAlbum', enabled: false }];
const hiddenResult = projectPublicInvitation(hidden);
assert.equal('giftRegistry' in hiddenResult, false);
assert.equal('lodging' in hiddenResult, false);
assert.equal('sharedAlbum' in hiddenResult, false);

assert.throws(() => projectPublicInvitation({ ...document, schemaVersion: 2 }), /Unsupported/);
console.log('Public invitation projection tests passed.');
