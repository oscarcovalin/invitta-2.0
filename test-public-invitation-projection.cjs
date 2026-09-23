const assert = require('node:assert/strict');
const { projectPublicInvitation } = require('./lib/public-invitation-projection.cjs');

const document = {
  schemaVersion: 1,
  projectId: 'private-project',
  revision: 3,
  event: { type: 'wedding', startsAt: '2027-05-01T18:00:00-06:00', timeZone: 'America/Mexico_City', internalNote: 'SECRET_EVENT' },
  content: { title: 'Ana y Luis', welcomeMessage: 'Bienvenidos', internalNote: 'SECRET_CONTENT' },
  design: { theme: 'vino', internalNote: 'SECRET_DESIGN' },
  sections: [{ id: 'giftRegistry', enabled: true, settings: { internalNote: 'SECRET_SETTINGS' } }, { id: 'lodging', enabled: true }, { id: 'sharedAlbum', enabled: true }, { id: 'details', enabled: true }, { id: 'itinerary', enabled: true }],
  assets: { hero: { storagePath: 'private/hero.webp' } },
  legacy: { config: {
    eventDateLabel: '1 de mayo de 2027',
    eventDateShort: '01 · 05 · 2027',
    ceremony: { venue: 'Parroquia', address: 'Calle Uno', time: '18:00', mapsUrl: 'javascript:SECRET_URL', image: 'SECRET_IMAGE' },
    reception: { venue: 'Jardín', address: 'Calle Dos', time: '20:00', internalNote: 'SECRET_RECEPTION' },
    itinerary: [{ icon: 'church', label: 'Ceremonia', time: '18:00', guestId: 'SECRET_ITINERARY' }],
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
  sections: [{ id: 'giftRegistry', enabled: true }, { id: 'lodging', enabled: true }, { id: 'sharedAlbum', enabled: true }, { id: 'details', enabled: true }, { id: 'itinerary', enabled: true }],
  dateLabels: { long: '1 de mayo de 2027', short: '01 · 05 · 2027' },
  details: { ceremony: { venue: 'Parroquia', address: 'Calle Uno', time: '18:00' }, reception: { venue: 'Jardín', address: 'Calle Dos', time: '20:00' } },
  itinerary: [{ icon: 'church', label: 'Ceremonia', time: '18:00' }],
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
hidden.sections = [{ id: 'giftRegistry', enabled: false }, { id: 'lodging', enabled: false }, { id: 'sharedAlbum', enabled: false }, { id: 'details', enabled: false }, { id: 'itinerary', enabled: false }];
const hiddenResult = projectPublicInvitation(hidden);
assert.equal('giftRegistry' in hiddenResult, false);
assert.equal('lodging' in hiddenResult, false);
assert.equal('sharedAlbum' in hiddenResult, false);
assert.equal('details' in hiddenResult, false);
assert.equal('itinerary' in hiddenResult, false);

const legacyDisabled = structuredClone(document);
legacyDisabled.legacy.config.itineraryEnabled = false;
assert.equal('itinerary' in projectPublicInvitation(legacyDisabled), false);

const unclassified = structuredClone(document);
unclassified.sections = [];
const unclassifiedResult = projectPublicInvitation(unclassified);
assert.equal('details' in unclassifiedResult, false);
assert.equal('itinerary' in unclassifiedResult, false);
assert.equal('giftRegistry' in unclassifiedResult, false);

assert.throws(() => projectPublicInvitation({ ...document, schemaVersion: 2 }), /Unsupported/);
console.log('Public invitation projection tests passed.');
