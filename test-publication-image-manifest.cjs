const assert = require('node:assert/strict');
const fs = require('node:fs');
const { collectPublicationImages } = require('./lib/publication-image-manifest.cjs');

const projectId = '20000000-0000-4000-8000-000000000001';
const assetId = '30000000-0000-4000-8000-000000000001';
const image = (slot) => `${projectId}/${slot}/${assetId}.webp`;
const document = {
  projectId,
  sections: [
    { id: 'hero', enabled: true },
    { id: 'details', enabled: true },
    { id: 'gallery', enabled: true },
    { id: 'story', enabled: false },
  ],
  assets: { ceremony: { storagePath: image('ceremony') }, reception: { storagePath: image('reception') } },
  legacy: { config: {
    countdownPhoto: image('hero'),
    photos: { hero: image('hero'), portrait: image('hero'), galleryEnabled: true, gallery: [image('gallery')] },
    sectionBackgrounds: { details: { image: image('section-background') }, story: { image: image('section-background') } },
    ceremony: { image: '' }, reception: { image: '' },
    story: { photo: image('hero') },
  } },
};

assert.deepEqual(collectPublicationImages(document), [
  { field: 'photos.hero', storagePath: image('hero') },
  { field: 'photos.portrait', storagePath: image('hero') },
  { field: 'countdownPhoto', storagePath: image('hero') },
  { field: 'ceremony.image', storagePath: image('ceremony') },
  { field: 'reception.image', storagePath: image('reception') },
  { field: 'photos.gallery.0', storagePath: image('gallery') },
  { field: 'sectionBackgrounds.details.image', storagePath: image('section-background') },
]);

const hidden = structuredClone(document);
hidden.sections = [];
assert.deepEqual(collectPublicationImages(hidden), [{ field: 'countdownPhoto', storagePath: image('hero') }]);

const countdownHidden = structuredClone(document);
countdownHidden.legacy.config.countdownPhotoEnabled = false;
assert.equal(collectPublicationImages(countdownHidden).some((entry) => entry.field === 'countdownPhoto'), false);

const legacyHidden = structuredClone(document);
legacyHidden.legacy.config.locations = { enabled: false };
legacyHidden.sections.find((section) => section.id === 'story').enabled = true;
legacyHidden.legacy.config.story.enabled = false;
assert.equal(collectPublicationImages(legacyHidden).some((entry) =>
  ['ceremony.image', 'reception.image', 'story.photo', 'sectionBackgrounds.details.image', 'sectionBackgrounds.story.image'].includes(entry.field)), false);
legacyHidden.legacy.config.locations = { enabled: true };
legacyHidden.legacy.config.locationsEnabled = false;
assert.equal(collectPublicationImages(legacyHidden).some((entry) =>
  ['ceremony.image', 'reception.image', 'sectionBackgrounds.details.image'].includes(entry.field)), false);

const disabledBackgrounds = structuredClone(document);
disabledBackgrounds.sections = ['hero', 'details', 'gallery', 'giftRegistry', 'itinerary', 'lodging', 'sharedAlbum', 'rsvp', 'unknown']
  .map((id) => ({ id, enabled: true }));
disabledBackgrounds.legacy.config.sectionBackgrounds = Object.fromEntries(
  disabledBackgrounds.sections.map(({ id }) => [id, { image: image('section-background') }])
);
disabledBackgrounds.legacy.config.photos.galleryEnabled = false;
disabledBackgrounds.legacy.config.giftRegistry = { enabled: false };
disabledBackgrounds.legacy.config.itineraryEnabled = false;
disabledBackgrounds.legacy.config.itinerary = [{ label: 'Ceremonia' }];
disabledBackgrounds.legacy.config.lodging = { enabled: false, hotels: [{ name: 'Hotel' }] };
disabledBackgrounds.legacy.config.sharedAlbum = { enabled: false };
disabledBackgrounds.legacy.config.rsvpEnabled = false;
assert.deepEqual(collectPublicationImages(disabledBackgrounds)
  .filter((entry) => entry.field.startsWith('sectionBackgrounds.'))
  .map((entry) => entry.field), [
    'sectionBackgrounds.hero.image', 'sectionBackgrounds.details.image'
  ]);
disabledBackgrounds.legacy.config.photos.galleryEnabled = true;
disabledBackgrounds.legacy.config.giftRegistry.enabled = true;
disabledBackgrounds.legacy.config.itineraryEnabled = true;
disabledBackgrounds.legacy.config.lodging.enabled = true;
disabledBackgrounds.legacy.config.sharedAlbum.enabled = true;
disabledBackgrounds.legacy.config.rsvpEnabled = true;
assert.deepEqual(collectPublicationImages(disabledBackgrounds)
  .filter((entry) => entry.field.startsWith('sectionBackgrounds.'))
  .map((entry) => entry.field), [
    'sectionBackgrounds.hero.image', 'sectionBackgrounds.details.image',
    'sectionBackgrounds.gallery.image', 'sectionBackgrounds.giftRegistry.image',
    'sectionBackgrounds.itinerary.image', 'sectionBackgrounds.lodging.image',
    'sectionBackgrounds.sharedAlbum.image', 'sectionBackgrounds.rsvp.image'
  ]);

for (const badPath of [
  '40000000-0000-4000-8000-000000000001/hero/30000000-0000-4000-8000-000000000001.webp',
  '../secret.webp',
  'https://example.com/photo.webp',
  'data:image/webp;base64,AAAA',
  `${projectId}/gallery/${assetId}.svg`,
  `${projectId}/hero/${assetId}xwebp`,
  'assets/hero-catalina-user.jpg',
]) {
  const bad = structuredClone(document);
  bad.legacy.config.photos.hero = badPath;
  assert.throws(() => collectPublicationImages(bad), /Invalid publication image/);
}

const disabledGallery = structuredClone(document);
disabledGallery.legacy.config.photos.galleryEnabled = false;
assert.equal(collectPublicationImages(disabledGallery).some((entry) => entry.field.startsWith('photos.gallery')), false);

const bundled = structuredClone(document);
bundled.legacy.config.photos.hero = 'assets/hero-boda-hd.jpg';
bundled.legacy.config.photos.portrait = 'assets/portrait-boda-hd.jpg';
bundled.legacy.config.photos.gallery = ['assets/gallery-boda-1.jpg'];
assert.deepEqual(collectPublicationImages(bundled).filter((entry) => entry.publicPath), [
  { field: 'photos.hero', publicPath: 'assets/hero-boda-hd.jpg' },
  { field: 'photos.portrait', publicPath: 'assets/portrait-boda-hd.jpg' },
  { field: 'photos.gallery.0', publicPath: 'assets/gallery-boda-1.jpg' },
]);
for (const entry of collectPublicationImages(bundled).filter((item) => item.publicPath)) {
  assert.equal(fs.existsSync(entry.publicPath), true, `${entry.publicPath} must be bundled`);
}

assert.throws(() => collectPublicationImages({ ...document, projectId: 'bad-id' }), /Invalid publication project/);
console.log('Publication image manifest tests passed.');
