const assert = require('node:assert/strict');
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
    photos: { hero: image('hero'), portrait: image('hero'), galleryEnabled: true, gallery: [image('gallery')] },
    sectionBackgrounds: { details: { image: image('section-background') }, story: { image: image('section-background') } },
    ceremony: { image: '' }, reception: { image: '' },
    story: { photo: image('hero') },
  } },
};

assert.deepEqual(collectPublicationImages(document), [
  { field: 'photos.hero', storagePath: image('hero') },
  { field: 'photos.portrait', storagePath: image('hero') },
  { field: 'ceremony.image', storagePath: image('ceremony') },
  { field: 'reception.image', storagePath: image('reception') },
  { field: 'photos.gallery.0', storagePath: image('gallery') },
  { field: 'sectionBackgrounds.details.image', storagePath: image('section-background') },
]);

const hidden = structuredClone(document);
hidden.sections = [];
assert.deepEqual(collectPublicationImages(hidden), []);

for (const badPath of [
  '40000000-0000-4000-8000-000000000001/hero/30000000-0000-4000-8000-000000000001.webp',
  '../secret.webp',
  'https://example.com/photo.webp',
  'data:image/webp;base64,AAAA',
  `${projectId}/gallery/${assetId}.svg`,
]) {
  const bad = structuredClone(document);
  bad.legacy.config.photos.hero = badPath;
  assert.throws(() => collectPublicationImages(bad), /Invalid publication image/);
}

const disabledGallery = structuredClone(document);
disabledGallery.legacy.config.photos.galleryEnabled = false;
assert.equal(collectPublicationImages(disabledGallery).some((entry) => entry.field.startsWith('photos.gallery')), false);

assert.throws(() => collectPublicationImages({ ...document, projectId: 'bad-id' }), /Invalid publication project/);
console.log('Publication image manifest tests passed.');
