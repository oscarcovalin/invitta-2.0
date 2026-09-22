const assert = require('assert');
const {
  fromLegacyTemplateConfig,
  toLegacyTemplateConfig
} = require('./invitation-document-adapter.js');
const { validateInvitationDocument } = require('./invitation-document.js');

const legacy = {
  eventType: 'xv',
  name: 'Mis XV Valentina',
  brideName: 'Valentina',
  nameConnector: '',
  welcomeMessage: 'Celebra conmigo.',
  eventDateISO: '2027-03-20T18:00',
  timezoneOffset: '-06:00',
  eventDurationHours: 7,
  itinerary: [{ time: '21:30', label: 'Vals' }],
  theme: 'rosa',
  sectionOrder: ['hero', 'itinerary', 'rsvp'],
  sectionVisibility: { hero: true, itinerary: true, rsvp: false },
  ceremony: { image: '20000000-0000-4000-8000-000000000002/ceremony/30000000-0000-4000-8000-000000000002.webp' },
  reception: { image: 'data:image/png;base64,AAAA' }
};

const { document, pendingAssets } = fromLegacyTemplateConfig(legacy, {
  projectId: '20000000-0000-4000-8000-000000000002',
  revision: 3
});

assert.strictEqual(validateInvitationDocument(document).valid, true);
assert.strictEqual(document.event.type, 'quinceanera');
assert.strictEqual(document.revision, 3);
assert.strictEqual(document.assets.ceremony.storagePath, legacy.ceremony.image);
assert.strictEqual(document.assets.reception, undefined);
assert.deepStrictEqual(pendingAssets, [{ key: 'reception', source: legacy.reception.image }]);
assert.deepStrictEqual(document.sections.map(({ id, enabled }) => ({ id, enabled })), [
  { id: 'hero', enabled: true },
  { id: 'itinerary', enabled: true },
  { id: 'rsvp', enabled: false }
]);

const restored = toLegacyTemplateConfig(document);
assert.strictEqual(restored.eventType, legacy.eventType);
assert.strictEqual(restored.name, legacy.name);
assert.strictEqual(restored.brideName, legacy.brideName);
assert.deepStrictEqual(restored.itinerary, legacy.itinerary);
assert.deepStrictEqual(restored.sectionOrder, legacy.sectionOrder);
assert.deepStrictEqual(restored.sectionVisibility, legacy.sectionVisibility);
assert.strictEqual(restored.ceremony.image, legacy.ceremony.image);
assert.strictEqual(restored.reception.image, '');

const advanced = {
  ...legacy,
  typography: { names: 'Bodoni Moda', scale: 1.2 },
  dressCode: { colors: ['#ab1234'] },
  photos: { gallery: ['data:image/png;base64,AAAA'] }
};
advanced.photos.banner = 'https://images.example.test/banner.webp';
const advancedResult = fromLegacyTemplateConfig(advanced, {
  projectId: '20000000-0000-4000-8000-000000000002',
  revision: 4
});
assert.deepStrictEqual(advancedResult.document.legacy.config.typography, advanced.typography);
assert.deepStrictEqual(advancedResult.document.legacy.config.dressCode, advanced.dressCode);
assert.strictEqual(advancedResult.document.legacy.config.photos.gallery[0], '');
assert.strictEqual(advancedResult.document.legacy.config.photos.banner, '');
assert.ok(advancedResult.pendingAssets.some((item) => item.key === 'photos.gallery.0'));
assert.ok(advancedResult.pendingAssets.some((item) => item.key === 'photos.banner'));
assert.deepStrictEqual(toLegacyTemplateConfig(advancedResult.document).typography, advanced.typography);

console.log('Legacy invitation adapter preserves supported fields and quarantines inline assets.');
