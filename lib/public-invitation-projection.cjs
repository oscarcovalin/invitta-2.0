'use strict';
const { isLegacySectionVisible } = require('./publication-section-visibility.cjs');

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

function mapUrl(value, provider) {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
    if (provider === 'waze') return url.hostname === 'waze.com' && url.pathname.startsWith('/ul') ? url.href : null;
    if (url.hostname === 'maps.google.com') return url.href;
    return url.hostname === 'www.google.com' && url.pathname.startsWith('/maps') ? url.href : null;
  } catch (_) {
    return null;
  }
}

function pickVenue(source) {
  const result = pick(source, ['venue', 'address', 'time']);
  const maps = mapUrl(source && source.mapsUrl, 'google');
  const waze = mapUrl(source && source.wazeUrl, 'waze');
  if (maps) result.mapsUrl = maps;
  if (waze) result.wazeUrl = waze;
  return result;
}

function projectPublicInvitation(document) {
  if (!document || document.schemaVersion !== 1) throw new TypeError('Unsupported invitation document.');

  const config = document.legacy && document.legacy.config || {};
  const sections = Array.isArray(document.sections)
    ? document.sections.map((section) => pick(section, ['id', 'enabled']))
      .filter((section) => typeof section.id === 'string' && typeof section.enabled === 'boolean')
      .map((section) => ({ id: section.id, enabled: section.enabled && isLegacySectionVisible(section.id, config) }))
    : [];
  const enabled = (id) => sections.some((section) => section.id === id && section.enabled);
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
      ceremony: pickVenue(config.ceremony),
      reception: pickVenue(config.reception),
    };
  }
  if (enabled('itinerary')) {
    const steps = config.itinerary.filter((step) => typeof step?.label === 'string' && step.label.trim());
    if (steps.length) result.itinerary = steps.map((step) => pick(step, ['icon', 'label', 'time']));
  }
  if (enabled('story')) {
    result.story = pick(config.story, ['title', 'subtitle', 'text']);
  }
  if (enabled('rsvp')) {
    const title = config.rsvp && typeof config.rsvp.title === 'string' ? config.rsvp.title : config.rsvpTitle;
    result.rsvp = {};
    if (typeof title === 'string') result.rsvp.title = title;
    if (typeof config.rsvpDeadlineLabel === 'string') result.rsvp.deadlineLabel = config.rsvpDeadlineLabel;
    if (typeof config.whatsappNumber === 'string') result.whatsappNumber = config.whatsappNumber;
    if (Array.isArray(config.whatsappHosts)) {
      result.whatsappHosts = config.whatsappHosts.map((host) => pick(host, ['label', 'phone']));
    }
  }

  if (enabled('giftRegistry') && config.giftRegistry.bank) {
    result.giftRegistry = { bank: pick(config.giftRegistry.bank, ['bankName', 'holder', 'clabe']) };
  }
  if (enabled('lodging')) {
    result.lodging = { hotels: config.lodging.hotels.map((hotel) => {
      const publicHotel = pick(hotel, ['name', 'code']);
      const maps = mapUrl(hotel && hotel.mapsUrl, 'google');
      if (maps) publicHotel.mapsUrl = maps;
      return publicHotel;
    }) };
  }
  if (enabled('sharedAlbum')) {
    result.sharedAlbum = pick(config.sharedAlbum, ['accessCode']);
  }
  return result;
}

module.exports = { projectPublicInvitation };
