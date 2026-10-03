'use strict';

const INVITATION_SCHEMA_VERSION = 1;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validateInvitationDocument(document) {
  const errors = [];
  const requiredObjects = ['event', 'content', 'design', 'assets'];

  if (!document || typeof document !== 'object' || Array.isArray(document)) {
    return { valid: false, errors: ['Document must be an object.'] };
  }
  if (document.schemaVersion !== INVITATION_SCHEMA_VERSION) errors.push('Unsupported schemaVersion.');
  if (!UUID_PATTERN.test(document.projectId || '')) errors.push('projectId must be a valid UUID.');
  if (!Number.isInteger(document.revision) || document.revision < 1) errors.push('revision must be a positive integer.');
  for (const key of requiredObjects) {
    if (!document[key] || typeof document[key] !== 'object' || Array.isArray(document[key])) {
      errors.push(`${key} must be an object.`);
    }
  }
  if (!Array.isArray(document.sections)) errors.push('sections must be an array.');

  const event = document.event || {};
  if (!['wedding', 'quinceanera', 'other'].includes(event.type)) errors.push('event.type is invalid.');
  if (typeof event.startsAt !== 'string' || Number.isNaN(Date.parse(event.startsAt))) {
    errors.push('event.startsAt must be an ISO date-time.');
  }
  if (typeof event.timeZone !== 'string' || !event.timeZone.includes('/')) errors.push('event.timeZone is required.');

  const sectionIds = new Set();
  for (const section of document.sections || []) {
    if (!section || typeof section.id !== 'string' || !section.id) errors.push('Every section requires an id.');
    else if (sectionIds.has(section.id)) errors.push(`Duplicate section id: ${section.id}.`);
    else sectionIds.add(section.id);
    if (typeof section.enabled !== 'boolean') errors.push(`Section ${section.id || '?'} requires enabled.`);
  }

  for (const [key, asset] of Object.entries(document.assets || {})) {
    if (!asset || typeof asset.storagePath !== 'string' || !asset.storagePath.trim()) {
      errors.push(`Asset ${key} requires a Storage path.`);
    } else if (/^(?:data:|https?:\/\/)/i.test(asset.storagePath)) {
      errors.push(`Asset ${key} must reference a private Storage path, not inline or signed data.`);
    }
  }
  return { valid: errors.length === 0, errors };
}

module.exports = { INVITATION_SCHEMA_VERSION, validateInvitationDocument };
