const assert = require('node:assert/strict');
const { projectPublicInvitation } = require('./lib/public-invitation-projection.cjs');

const document = {
  schemaVersion: 1,
  projectId: 'private-project',
  revision: 3,
  event: { type: 'wedding', startsAt: '2027-05-01T18:00:00-06:00', timeZone: 'America/Mexico_City', internalNote: 'SECRET_EVENT' },
  content: { title: 'Ana y Luis', welcomeMessage: 'Bienvenidos', internalNote: 'SECRET_CONTENT' },
  design: { theme: 'vino', internalNote: 'SECRET_DESIGN' },
  sections: [{ id: 'giftRegistry', enabled: true, settings: { internalNote: 'SECRET_SETTINGS' } }, { id: 'lodging', enabled: true }, { id: 'sharedAlbum', enabled: true }, { id: 'details', enabled: true }, { id: 'itinerary', enabled: true }, { id: 'rsvp', enabled: true }],
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
  sections: [{ id: 'giftRegistry', enabled: true }, { id: 'lodging', enabled: true }, { id: 'sharedAlbum', enabled: true }, { id: 'details', enabled: true }, { id: 'itinerary', enabled: true }, { id: 'rsvp', enabled: true }],
  dateLabels: { long: '1 de mayo de 2027', short: '01 · 05 · 2027' },
  details: { ceremony: { venue: 'Parroquia', address: 'Calle Uno', time: '18:00' }, reception: { venue: 'Jardín', address: 'Calle Dos', time: '20:00' } },
  itinerary: [{ icon: 'church', label: 'Ceremonia', time: '18:00' }],
  giftRegistry: { bank: { bankName: 'Banco', holder: 'Ana', clabe: '123456789012345678' } },
  rsvp: {},
  whatsappNumber: '5215550001111',
  whatsappHosts: [{ label: 'Ana', phone: '5215550002222' }],
  lodging: { hotels: [{ name: 'Hotel', code: 'FIESTA' }] },
  sharedAlbum: { accessCode: 'ALBUM' },
});
assert.equal(JSON.stringify(result).includes('SECRET_'), false);
assert.equal(JSON.stringify(result).includes('private/hero.webp'), false);
assert.equal(JSON.stringify(result).includes('defaultPassCount'), false);

const hidden = structuredClone(document);
hidden.sections = [{ id: 'giftRegistry', enabled: false }, { id: 'lodging', enabled: false }, { id: 'sharedAlbum', enabled: false }, { id: 'details', enabled: false }, { id: 'itinerary', enabled: false }, { id: 'rsvp', enabled: false }];
const hiddenResult = projectPublicInvitation(hidden);
assert.equal('giftRegistry' in hiddenResult, false);
assert.equal('lodging' in hiddenResult, false);
assert.equal('sharedAlbum' in hiddenResult, false);
assert.equal('details' in hiddenResult, false);
assert.equal('itinerary' in hiddenResult, false);
assert.equal('rsvp' in hiddenResult, false);
assert.equal('whatsappNumber' in hiddenResult, false);
assert.equal('whatsappHosts' in hiddenResult, false);

const legacyDisabled = structuredClone(document);
legacyDisabled.legacy.config.itineraryEnabled = false;
assert.equal('itinerary' in projectPublicInvitation(legacyDisabled), false);
legacyDisabled.legacy.config.itineraryEnabled = true;
legacyDisabled.legacy.config.itinerary.push({ label: '   ', time: 'SECRET_TIME' });
assert.deepEqual(projectPublicInvitation(legacyDisabled).itinerary, [
  { icon: 'church', label: 'Ceremonia', time: '18:00' }
]);
legacyDisabled.legacy.config.itinerary = [{ label: '', time: 'SECRET_TIME' }];
assert.equal('itinerary' in projectPublicInvitation(legacyDisabled), false);
legacyDisabled.legacy.config.locations = { enabled: false };
assert.equal('details' in projectPublicInvitation(legacyDisabled), false);
legacyDisabled.legacy.config.locations = { enabled: true };
legacyDisabled.legacy.config.locationsEnabled = false;
assert.equal('details' in projectPublicInvitation(legacyDisabled), false);
legacyDisabled.legacy.config.rsvpEnabled = false;
assert.equal('whatsappNumber' in projectPublicInvitation(legacyDisabled), false);
assert.equal('whatsappHosts' in projectPublicInvitation(legacyDisabled), false);

const unclassified = structuredClone(document);
unclassified.sections = [];
const unclassifiedResult = projectPublicInvitation(unclassified);
assert.equal('details' in unclassifiedResult, false);
assert.equal('itinerary' in unclassifiedResult, false);
assert.equal('giftRegistry' in unclassifiedResult, false);
assert.equal('whatsappNumber' in unclassifiedResult, false);
assert.equal('whatsappHosts' in unclassifiedResult, false);

const links = structuredClone(document);
links.legacy.config.ceremony.mapsUrl = 'https://maps.google.com/?q=Parroquia';
links.legacy.config.ceremony.wazeUrl = 'https://waze.com/ul?q=Parroquia';
links.legacy.config.reception.mapsUrl = 'https://maps.google.com.evil.test/place';
links.legacy.config.reception.wazeUrl = 'https://waze.com@evil.test/ul';
links.legacy.config.lodging.hotels[0].mapsUrl = 'https://www.google.com/maps/place/Hotel';
assert.deepEqual(projectPublicInvitation(links).details, {
  ceremony: {
    venue: 'Parroquia', address: 'Calle Uno', time: '18:00',
    mapsUrl: 'https://maps.google.com/?q=Parroquia',
    wazeUrl: 'https://waze.com/ul?q=Parroquia',
  },
  reception: { venue: 'Jardín', address: 'Calle Dos', time: '20:00' },
});
assert.deepEqual(projectPublicInvitation(links).lodging.hotels[0], {
  name: 'Hotel', code: 'FIESTA', mapsUrl: 'https://www.google.com/maps/place/Hotel',
});

const unsafeLinks = structuredClone(links);
unsafeLinks.legacy.config.ceremony.mapsUrl = 'http://maps.google.com/?q=Parroquia';
unsafeLinks.legacy.config.ceremony.wazeUrl = 'https://user@waze.com/ul?q=Parroquia';
unsafeLinks.legacy.config.lodging.hotels[0].mapsUrl = 'javascript:alert(1)';
const unsafeResult = projectPublicInvitation(unsafeLinks);
assert.equal('mapsUrl' in unsafeResult.details.ceremony, false);
assert.equal('wazeUrl' in unsafeResult.details.ceremony, false);
assert.equal('mapsUrl' in unsafeResult.lodging.hotels[0], false);

const copy = structuredClone(document);
copy.sections.push({ id: 'story', enabled: true });
copy.legacy.config.story = { enabled: true, title: 'Nuestra historia', subtitle: 'Así comenzó', text: 'Nos conocimos en mayo.', photo: 'SECRET_PHOTO', internalNote: 'SECRET_STORY' };
copy.legacy.config.rsvp = { enabled: true, title: 'Confirma tu asistencia', internalNote: 'SECRET_RSVP' };
copy.legacy.config.rsvpTitle = 'Título anterior';
copy.legacy.config.rsvpDeadlineLabel = 'Confirma antes del 1 de abril';
assert.deepEqual(projectPublicInvitation(copy).story, {
  title: 'Nuestra historia', subtitle: 'Así comenzó', text: 'Nos conocimos en mayo.',
});
assert.deepEqual(projectPublicInvitation(copy).rsvp, {
  title: 'Confirma tu asistencia', deadlineLabel: 'Confirma antes del 1 de abril',
});
assert.equal(JSON.stringify(projectPublicInvitation(copy)).includes('SECRET_'), false);

copy.sections.find((section) => section.id === 'story').enabled = false;
copy.sections.find((section) => section.id === 'rsvp').enabled = false;
assert.equal('story' in projectPublicInvitation(copy), false);
assert.equal('rsvp' in projectPublicInvitation(copy), false);
assert.equal('whatsappNumber' in projectPublicInvitation(copy), false);
assert.equal('whatsappHosts' in projectPublicInvitation(copy), false);
copy.sections.find((section) => section.id === 'story').enabled = true;
copy.sections.find((section) => section.id === 'rsvp').enabled = true;
copy.legacy.config.story.enabled = false;
copy.legacy.config.rsvp.enabled = false;
assert.equal('story' in projectPublicInvitation(copy), false);
assert.equal('rsvp' in projectPublicInvitation(copy), false);
assert.equal('whatsappNumber' in projectPublicInvitation(copy), false);
assert.equal('whatsappHosts' in projectPublicInvitation(copy), false);
copy.legacy.config.story = { enabled: true, subtitle: 'Sólo subtítulo' };
assert.equal('story' in projectPublicInvitation(copy), false);

assert.throws(() => projectPublicInvitation({ ...document, schemaVersion: 2 }), /Unsupported/);
console.log('Public invitation projection tests passed.');
