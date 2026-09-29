const assert = require('assert');
const {
  fromLegacyTemplateConfig,
  toLegacyTemplateConfig
} = require('./invitation-document-adapter.js');
const { validateInvitationDocument } = require('./invitation-document.js');
const TemplateEngine = require('./template-engine.js');

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
  ceremony: { venue: 'Capilla Santa Ana', address: 'Calle Uno 12', time: '18:00', image: '20000000-0000-4000-8000-000000000002/ceremony/30000000-0000-4000-8000-000000000002.webp' },
  reception: { venue: 'Salón Jardín', address: 'Avenida Dos 34', time: '20:00', image: 'data:image/png;base64,AAAA' }
};

const { document, pendingAssets } = fromLegacyTemplateConfig(legacy, {
  projectId: '20000000-0000-4000-8000-000000000002',
  revision: 3
});

assert.strictEqual(validateInvitationDocument(document).valid, true);
assert.strictEqual(document.event.type, 'quinceanera');
assert.strictEqual(document.content.primaryName, legacy.name);
assert.strictEqual(document.content.secondaryName, '');
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
assert.strictEqual(restored.brideName, legacy.name);
assert.deepStrictEqual(restored.itinerary, legacy.itinerary);
assert.deepStrictEqual(restored.sectionOrder, legacy.sectionOrder);
assert.deepStrictEqual(restored.sectionVisibility, legacy.sectionVisibility);
assert.strictEqual(restored.ceremony.image, legacy.ceremony.image);
assert.strictEqual(restored.reception.image, '');
for (const location of ['ceremony', 'reception']) {
  for (const field of ['venue', 'address', 'time']) {
    assert.strictEqual(restored[location][field], legacy[location][field]);
  }
}

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

const studioConfig = {
  eventType: 'boda', name: 'Ana y Luis', eventDateISO: '2027-05-01T18:00',
  story: { enabled: true, title: 'Nos conocimos en mayo' },
  locations: { enabled: false },
  itinerary: [{ time: '18:00', label: 'Ceremonia' }],
  giftRegistry: { enabled: false, bank: { holder: 'Ana' } },
  lodging: { enabled: true, hotels: [{ name: 'Hotel' }] },
  sharedAlbum: { enabled: false, accessCode: 'FOTOS' },
  rsvp: { enabled: true }, rsvpEnabled: false,
  photos: { galleryEnabled: true, gallery: ['assets/gallery-boda-1.jpg'] },
};
const studioDocument = fromLegacyTemplateConfig(studioConfig, {
  projectId: '20000000-0000-4000-8000-000000000002', revision: 1
}).document;
assert.deepStrictEqual(studioDocument.sections.map((section) => section.id), [
  'hero', 'story', 'details', 'lodging', 'gallery', 'giftRegistry', 'itinerary', 'sharedAlbum', 'rsvp'
]);
assert.strictEqual(studioDocument.sections.find((section) => section.id === 'story').enabled, true);
assert.strictEqual(studioDocument.sections.find((section) => section.id === 'details').enabled, false);
assert.strictEqual(studioDocument.sections.find((section) => section.id === 'giftRegistry').enabled, false);
assert.strictEqual(studioDocument.sections.find((section) => section.id === 'rsvp').enabled, false);
assert.deepStrictEqual(toLegacyTemplateConfig(studioDocument).sectionOrder,
  studioDocument.sections.map((section) => section.id));

const defaultStudioDocument = fromLegacyTemplateConfig(TemplateEngine.defaultConfig, {
  projectId: '20000000-0000-4000-8000-000000000002', revision: 1
}).document;
assert.strictEqual(defaultStudioDocument.sections.find((section) => section.id === 'hero').enabled, true);
assert.strictEqual(defaultStudioDocument.sections.find((section) => section.id === 'story').enabled, true);
assert.strictEqual(defaultStudioDocument.sections.find((section) => section.id === 'rsvp').enabled, true);
assert.strictEqual(validateInvitationDocument(defaultStudioDocument).valid, true);

console.log('Legacy invitation adapter preserves supported fields and quarantines inline assets.');
