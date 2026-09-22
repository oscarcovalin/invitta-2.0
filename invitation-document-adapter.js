const { INVITATION_SCHEMA_VERSION } = require('./invitation-document.js');

const EVENT_TYPES_TO_CANONICAL = { boda: 'wedding', xv: 'quinceanera' };
const EVENT_TYPES_TO_LEGACY = { wedding: 'boda', quinceanera: 'xv', other: 'other' };
const ASSET_FIELDS = ['ceremony', 'reception'];

function normalizeStartsAt(value, offset) {
  if (!value) return new Date().toISOString();
  if (/[zZ]$|[+-]\d\d:\d\d$/.test(value)) return value;
  return `${value}:00${offset || '-06:00'}`;
}

function fromLegacyTemplateConfig(config, { projectId, revision = 1 } = {}) {
  if (!config || typeof config !== 'object') throw new TypeError('Legacy config must be an object.');
  if (!projectId) throw new TypeError('projectId is required.');

  const sectionOrder = Array.isArray(config.sectionOrder) ? config.sectionOrder : [];
  const visibility = config.sectionVisibility || {};
  const assets = {};
  const pendingAssets = [];

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
      sections: sectionOrder.map((id) => ({ id, enabled: visibility[id] !== false })),
      assets,
      legacy: { source: 'template-engine-v2' }
    },
    pendingAssets
  };
}

function toLegacyTemplateConfig(document) {
  const content = document.content || {};
  const sections = document.sections || [];
  const config = {
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
    config[key] = { image: document.assets && document.assets[key] ? document.assets[key].storagePath : '' };
  }
  return config;
}

module.exports = { fromLegacyTemplateConfig, toLegacyTemplateConfig };
