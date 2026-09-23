'use strict';

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
const PROJECT_ID = new RegExp(`^${UUID}$`, 'i');
const STORAGE_PATH = new RegExp(`^(${UUID})/(hero|ceremony|reception|gallery|section-background|shared-album|logo)/${UUID}[.](jpg|png|webp|gif)$`, 'i');
const BUNDLED_IMAGES = new Set([
  'assets/hero-boda-hd.jpg', 'assets/hero-xv-hd.jpg', 'assets/portrait-boda-hd.jpg',
  ...Array.from({ length: 8 }, (_, index) => `assets/gallery-boda-${index + 1}.jpg`),
  ...Array.from({ length: 6 }, (_, index) => `assets/gallery-xv-${index + 1}.jpg`),
]);

function collectPublicationImages(document) {
  if (!document || !PROJECT_ID.test(document.projectId || '')) throw new TypeError('Invalid publication project.');
  const sections = Array.isArray(document.sections) ? document.sections : [];
  const enabled = (id) => sections.some((section) => section && section.id === id && section.enabled === true);
  const config = document.legacy && document.legacy.config || {};
  const assets = document.assets || {};
  const result = [];
  const visible = (id) => enabled(id)
    && (id !== 'details' || ((!config.locations || config.locations.enabled !== false) && config.locationsEnabled !== false))
    && (id !== 'story' || !!(config.story && config.story.enabled !== false && (config.story.title || config.story.text)));

  function add(field, value, slot) {
    if (value == null || value === '') return;
    if (BUNDLED_IMAGES.has(value)) {
      result.push({ field, publicPath: value });
      return;
    }
    const match = typeof value === 'string' && STORAGE_PATH.exec(value);
    if (!match || match[1].toLowerCase() !== document.projectId.toLowerCase() || match[2].toLowerCase() !== slot) {
      throw new TypeError(`Invalid publication image: ${field}.`);
    }
    result.push({ field, storagePath: value });
  }

  if (enabled('hero')) {
    add('photos.hero', (assets.hero && assets.hero.storagePath) || (config.photos && config.photos.hero), 'hero');
    add('photos.portrait', config.photos && config.photos.portrait, 'hero');
  }
  if (visible('details')) {
    add('ceremony.image', (assets.ceremony && assets.ceremony.storagePath) || (config.ceremony && config.ceremony.image), 'ceremony');
    add('reception.image', (assets.reception && assets.reception.storagePath) || (config.reception && config.reception.image), 'reception');
  }
  if (enabled('gallery') && config.photos && config.photos.galleryEnabled !== false && Array.isArray(config.photos.gallery)) {
    config.photos.gallery.forEach((value, index) => add(`photos.gallery.${index}`, value, 'gallery'));
  }
  if (visible('story')) add('story.photo', config.story && config.story.photo, 'hero');
  if (config.sectionBackgrounds && typeof config.sectionBackgrounds === 'object') {
    for (const section of sections) {
      if (!section || typeof section.id !== 'string' || !visible(section.id)) continue;
      const background = config.sectionBackgrounds[section.id];
      add(`sectionBackgrounds.${section.id}.image`, background && background.image, 'section-background');
    }
  }
  return result;
}

module.exports = { collectPublicationImages };
