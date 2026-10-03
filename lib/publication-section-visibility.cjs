'use strict';

function isLegacySectionVisible(id, config = {}) {
  switch (id) {
    case 'hero': return true;
    case 'details': return (!config.locations || config.locations.enabled !== false) && config.locationsEnabled !== false;
    case 'story': return !!(config.story && config.story.enabled !== false && (config.story.title || config.story.text));
    case 'gallery': return !!(config.photos && config.photos.galleryEnabled !== false && Array.isArray(config.photos.gallery) && config.photos.gallery.length);
    case 'giftRegistry': return !!(config.giftRegistry && config.giftRegistry.enabled !== false);
    case 'itinerary': return config.itineraryEnabled !== false && Array.isArray(config.itinerary)
      && config.itinerary.some((step) => typeof step?.label === 'string' && step.label.trim());
    case 'lodging': return !!(config.lodging && config.lodging.enabled !== false && Array.isArray(config.lodging.hotels) && config.lodging.hotels.length);
    case 'sharedAlbum': return !!(config.sharedAlbum && config.sharedAlbum.enabled !== false);
    case 'rsvp': return (!config.rsvp || config.rsvp.enabled !== false) && config.rsvpEnabled !== false;
    default: return false;
  }
}

module.exports = { isLegacySectionVisible };
