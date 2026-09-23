const INVITATION_SCHEMA_VERSION = typeof module === 'object' && module.exports
  ? require('./invitation-document.js').INVITATION_SCHEMA_VERSION
  : 1;

const EVENT_TYPES_TO_CANONICAL = { boda: 'wedding', xv: 'quinceanera' };
const EVENT_TYPES_TO_LEGACY = { wedding: 'boda', quinceanera: 'xv', other: 'other' };
const ASSET_FIELDS = ['ceremony', 'reception'];
const STUDIO_SECTION_ORDER = ['hero', 'story', 'details', 'lodging', 'gallery', 'giftRegistry', 'itinerary', 'sharedAlbum', 'rsvp'];

function studioSectionVisibility(config) {
  return {
    hero: true,
    story: !!(config.story && config.story.enabled !== false && (config.story.title || config.story.text)),
    details: (!config.locations || config.locations.enabled !== false) && config.locationsEnabled !== false,
    lodging: !!(config.lodging && config.lodging.enabled !== false && Array.isArray(config.lodging.hotels) && config.lodging.hotels.length),
    gallery: !!(config.photos && config.photos.galleryEnabled !== false && Array.isArray(config.photos.gallery) && config.photos.gallery.length),
    giftRegistry: !!(config.giftRegistry && config.giftRegistry.enabled !== false),
    itinerary: config.itineraryEnabled !== false && (!config.itinerary || config.itinerary.enabled !== false) && Array.isArray(config.itinerary) && config.itinerary.length > 0,
    sharedAlbum: !!(config.sharedAlbum && config.sharedAlbum.enabled !== false),
    rsvp: (!config.rsvp || config.rsvp.enabled !== false) && config.rsvpEnabled !== false,
  };
}

function normalizeStartsAt(value, offset) {
  if (!value) return new Date().toISOString();
  if (/[zZ]$|[+-]\d\d:\d\d$/.test(value)) return value;
  return `${value}:00${offset || '-06:00'}`;
}

function fromLegacyTemplateConfig(config, { projectId, revision = 1 } = {}) {
  if (!config || typeof config !== 'object') throw new TypeError('Legacy config must be an object.');
  if (!projectId) throw new TypeError('projectId is required.');

  const hasSectionOrder = Array.isArray(config.sectionOrder);
  const sectionOrder = hasSectionOrder ? config.sectionOrder : STUDIO_SECTION_ORDER;
  const visibility = config.sectionVisibility || {};
  const inferredVisibility = hasSectionOrder ? null : studioSectionVisibility(config);
  const assets = {};
  const pendingAssets = [];
  const legacyConfig = JSON.parse(JSON.stringify(config));

  function isUnmigratedAsset(value, path) {
    if (typeof value !== 'string') return false;
    if (/^data:/i.test(value)) return true;
    const assetPath = path.some((part) => /image|photo|logo|banner|gallery|background|savethedate/i.test(String(part)));
    return assetPath && /^https?:\/\//i.test(value);
  }

  function removeInlineAssets(value, path = []) {
    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        if (isUnmigratedAsset(item, path)) {
          pendingAssets.push({ key: [...path, index].join('.'), source: item });
          value[index] = '';
        } else if (item && typeof item === 'object') removeInlineAssets(item, [...path, index]);
      });
      return;
    }
    for (const [key, item] of Object.entries(value)) {
      if (isUnmigratedAsset(item, [...path, key])) {
        if (!(path.length === 1 && ASSET_FIELDS.includes(path[0]) && key === 'image')) {
          pendingAssets.push({ key: [...path, key].join('.'), source: item });
        }
        value[key] = '';
      } else if (item && typeof item === 'object') removeInlineAssets(item, [...path, key]);
    }
  }
  removeInlineAssets(legacyConfig);

  for (const key of ASSET_FIELDS) {
    const source = config[key] && config[key].image;
    if (!source) continue;
    if (/^(?:data:|https?:\/\/)/i.test(source)) pendingAssets.push({ key, source });
    else assets[key] = { storagePath: source };
  }

  return {
    document: {
      schemaVersion: INVITATION_SCHEMA_VERSION,
      projectId,
      revision,
      event: {
        type: EVENT_TYPES_TO_CANONICAL[config.eventType] || 'other',
        startsAt: normalizeStartsAt(config.eventDateISO, config.timezoneOffset),
        timeZone: config.timeZone || 'America/Mexico_City',
        durationMinutes: Math.max(1, Math.round((config.eventDurationHours || 6) * 60))
      },
      content: {
        title: config.name || '',
        primaryName: config.brideName || '',
        secondaryName: config.groomName || '',
        nameConnector: config.nameConnector == null ? '&' : config.nameConnector,
        welcomeMessage: config.welcomeMessage || '',
        itinerary: Array.isArray(config.itinerary) ? config.itinerary : []
      },
      design: { theme: config.theme || 'vino' },
      sections: sectionOrder.map((id) => ({ id, enabled: visibility[id] !== false && (!inferredVisibility || inferredVisibility[id] === true) })),
      assets,
      legacy: { source: 'template-engine-v2', config: legacyConfig }
    },
    pendingAssets
  };
}

function toLegacyTemplateConfig(document) {
  const content = document.content || {};
  const sections = document.sections || [];
  const config = {
    ...(document.legacy && document.legacy.config || {}),
    eventType: EVENT_TYPES_TO_LEGACY[document.event && document.event.type] || 'other',
    name: content.title || '',
    brideName: content.primaryName || '',
    groomName: content.secondaryName || '',
    nameConnector: content.nameConnector == null ? '&' : content.nameConnector,
    welcomeMessage: content.welcomeMessage || '',
    eventDateISO: document.event && document.event.startsAt,
    eventDurationHours: (document.event && document.event.durationMinutes || 360) / 60,
    itinerary: Array.isArray(content.itinerary) ? content.itinerary : [],
    theme: document.design && document.design.theme || 'vino',
    sectionOrder: sections.map((section) => section.id),
    sectionVisibility: Object.fromEntries(sections.map((section) => [section.id, section.enabled]))
  };

  for (const key of ASSET_FIELDS) {
    const location = config[key] && typeof config[key] === 'object' && !Array.isArray(config[key]) ? config[key] : {};
    config[key] = {
      ...location,
      image: document.assets && document.assets[key] ? document.assets[key].storagePath : ''
    };
  }
  return config;
}

const InvitationDocumentAdapter = { fromLegacyTemplateConfig, toLegacyTemplateConfig };
if (typeof module === 'object' && module.exports) module.exports = InvitationDocumentAdapter;
else if (typeof window !== 'undefined') window.InvitationDocumentAdapter = InvitationDocumentAdapter;
