'use strict';

// This is a data-classification slice, not a public endpoint or a render-ready artifact.
// Assets remain private until publication has an explicit, revision-scoped asset path.
function pick(source, keys) {
  const result = {};
  if (!source || typeof source !== 'object' || Array.isArray(source)) return result;
  for (const key of keys) {
    if (typeof source[key] === 'string' || typeof source[key] === 'boolean' || typeof source[key] === 'number') {
      result[key] = source[key];
    }
  }
  return result;
}

function projectPublicInvitation(document) {
  if (!document || document.schemaVersion !== 1) throw new TypeError('Unsupported invitation document.');

  const sections = Array.isArray(document.sections)
    ? document.sections.map((section) => pick(section, ['id', 'enabled']))
      .filter((section) => typeof section.id === 'string' && typeof section.enabled === 'boolean')
    : [];
  const enabled = (id) => sections.some((section) => section.id === id && section.enabled);
  const config = document.legacy && document.legacy.config || {};
  const result = {
    schemaVersion: 1,
    event: pick(document.event, ['type', 'startsAt', 'timeZone', 'durationMinutes']),
    content: pick(document.content, ['title', 'primaryName', 'secondaryName', 'nameConnector', 'welcomeMessage']),
    design: pick(document.design, ['theme']),
    sections,
  };

  result.dateLabels = {};
  if (typeof config.eventDateLabel === 'string') result.dateLabels.long = config.eventDateLabel;
  if (typeof config.eventDateShort === 'string') result.dateLabels.short = config.eventDateShort;
  if (enabled('details')) {
    result.details = {
      ceremony: pick(config.ceremony, ['venue', 'address', 'time']),
      reception: pick(config.reception, ['venue', 'address', 'time']),
    };
  }
  if (enabled('itinerary') && config.itineraryEnabled !== false && Array.isArray(config.itinerary)) {
    result.itinerary = config.itinerary.map((step) => pick(step, ['icon', 'label', 'time']));
  }

  if (enabled('giftRegistry') && config.giftRegistry && config.giftRegistry.enabled !== false && config.giftRegistry.bank) {
    result.giftRegistry = { bank: pick(config.giftRegistry.bank, ['bankName', 'holder', 'clabe']) };
  }
  if (typeof config.whatsappNumber === 'string') result.whatsappNumber = config.whatsappNumber;
  if (Array.isArray(config.whatsappHosts)) {
    result.whatsappHosts = config.whatsappHosts.map((host) => pick(host, ['label', 'phone']));
  }
  if (enabled('lodging') && config.lodging && config.lodging.enabled !== false && Array.isArray(config.lodging.hotels)) {
    result.lodging = { hotels: config.lodging.hotels.map((hotel) => pick(hotel, ['name', 'code'])) };
  }
  if (enabled('sharedAlbum') && config.sharedAlbum && config.sharedAlbum.enabled !== false) {
    result.sharedAlbum = pick(config.sharedAlbum, ['accessCode']);
  }
  return result;
}

module.exports = { projectPublicInvitation };
