'use strict';

const { buildPublicationCandidate } = require('./publication-candidate.cjs');
const { publicationSupabaseOrigin } = require('./publication-supabase-origin.cjs');

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PRIVATE_STORAGE_PATH = new RegExp(`^${UUID.source.slice(1, -1)}/[^\\s]+$`, 'i');
const MUSIC = new RegExp(`^(${UUID.source.slice(1, -1)})/music/(${UUID.source.slice(1, -1)})\\.mp3$`, 'i');
const MIME = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', mp3: 'audio/mpeg' };
const CONFIG_KEYS = new Set([
  'eventType', 'name', 'nameConnector', 'welcomeMessage', 'eventDateISO', 'eventDateLabel',
  'brideName', 'groomName',
  'eventDateShort', 'eventDurationHours', 'timezoneOffset', 'eyebrow', 'quote', 'monogram',
  'father', 'mother', 'brideFather', 'brideMother', 'groomFather', 'groomMother',
  'godfather', 'godmother', 'blessingIntro', 'court', 'familyStyle', 'ceremony', 'reception',
  'locations', 'locationsEnabled', 'countdown', 'countdownEnabled',
  'countdownPhoto', 'countdownPhotoEnabled', 'countdownPhrase', 'countdownStyle',
  'dressCode', 'photos', 'music', 'decorations', 'illustrations', 'typography', 'waxSeal',
  'sectionBackgrounds', 'giftRegistry', 'itinerary', 'itineraryEnabled', 'instagram',
  'lodging', 'story', 'stardust', 'sharedAlbum', 'rsvp', 'rsvpTitle', 'rsvpDeadlineLabel',
  'rsvpEnabled', 'defaultPassCount', 'whatsappNumber', 'whatsappHosts', 'footerClosing',
  'footerText', 'sectionOrder', 'sectionVisibility', 'theme',
]);
const PRIVATE_KEY = /(?:secret|token|password|private|internal|webhook|guestlist|masterpin|bridepin)/i;

class PublicReviewError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const notFound = () => new PublicReviewError(404, 'La invitación no está disponible.');

async function readRows(url, secretKey, fetchImpl) {
  const response = await fetchImpl(url, { method: 'GET', redirect: 'error', headers: { apikey: secretKey } });
  if (!response.ok) throw new PublicReviewError(502, 'No fue posible consultar la invitación.');
  const rows = await response.json();
  if (!Array.isArray(rows)) throw new PublicReviewError(502, 'No fue posible consultar la invitación.');
  return rows;
}

async function loadPublished({ slug, config, fetchImpl }) {
  const base = publicationSupabaseOrigin(config);
  if (!base) throw new PublicReviewError(503, 'La publicación no está configurada.');
  if (typeof slug !== 'string' || slug.length > 128 || !SLUG.test(slug)) throw notFound();
  const projectUrl = `${base}/rest/v1/invitation_projects?slug=eq.${slug}&select=id%2Cstatus%2Cpublished_document_id&limit=1`;
  const project = (await readRows(projectUrl, config.secretKey, fetchImpl))[0];
  if (!project || project.status !== 'published' || !UUID.test(project.id || '') || !UUID.test(project.published_document_id || '')) throw notFound();
  const documentUrl = `${base}/rest/v1/invitation_documents?id=eq.${project.published_document_id}&project_id=eq.${project.id}&select=revision%2Cdocument&limit=1`;
  const saved = (await readRows(documentUrl, config.secretKey, fetchImpl))[0];
  if (!saved || !saved.document || saved.revision !== saved.document.revision || saved.document.projectId !== project.id) throw notFound();
  let candidate;
  try { candidate = buildPublicationCandidate({ documentId: project.published_document_id, document: saved.document }); }
  catch (_) { throw notFound(); }
  async function assertCurrent() {
    const latest = (await readRows(projectUrl, config.secretKey, fetchImpl))[0];
    if (!latest || latest.status !== 'published' || latest.id !== project.id || latest.published_document_id !== project.published_document_id) throw notFound();
  }
  return { base, project, document: saved.document, candidate, assertCurrent };
}

function publicPresentation({ slug, document, candidate }) {
  const source = document.legacy && document.legacy.config || {};
  const allowedMedia = new Map(candidate.privateImages.map(({ field, storagePath }) => [storagePath, field]));
  const musicPath = source.music && source.music.enabled !== false && source.music.url;
  const validMusic = typeof musicPath === 'string' && MUSIC.test(musicPath) && musicPath.startsWith(`${document.projectId}/`);
  function clean(value, key = '') {
    if (PRIVATE_KEY.test(key)) return undefined;
    if (Array.isArray(value)) return value.map((item) => clean(item)).filter((item) => item !== undefined);
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).map(([childKey, item]) => [childKey, clean(item, childKey)])
        .filter(([, item]) => item !== undefined));
    }
    if (typeof value !== 'string') return value;
    if (value.length > 10000 || /^javascript:/i.test(value.trim())) return '';
    if (allowedMedia.has(value)) return `/api/public/review-media?slug=${encodeURIComponent(slug)}&field=${encodeURIComponent(allowedMedia.get(value))}`;
    if (validMusic && value === musicPath) return `/api/public/review-media?slug=${encodeURIComponent(slug)}&field=music`;
    if (PRIVATE_STORAGE_PATH.test(value)) return '';
    return value;
  }
  const selected = Object.fromEntries(Object.entries(source).filter(([key]) => CONFIG_KEYS.has(key)));
  const presentation = clean(selected);
  presentation.vendorCard = { enabled: false };
  presentation.eventType = document.event.type === 'quinceanera' ? 'xv' : document.event.type === 'wedding' ? 'boda' : 'other';
  if (presentation.eventType === 'xv') {
    delete presentation.brideName;
    delete presentation.groomName;
  }
  presentation.name = candidate.publicArtifact.content.content.title || presentation.name || '';
  return presentation;
}

async function readPublicReview({ slug, config, fetchImpl = fetch }) {
  const loaded = await loadPublished({ slug, config, fetchImpl });
  const presentation = publicPresentation({ slug, document: loaded.document, candidate: loaded.candidate });
  await loaded.assertCurrent();
  return { revision: loaded.candidate.source.revision, content: loaded.candidate.publicArtifact.content, presentation };
}

async function readPublicReviewMedia({ slug, field, config, fetchImpl = fetch }) {
  if (typeof field !== 'string' || field.length > 128 || !/^(?:[a-zA-Z0-9.]+|music)$/.test(field)) throw notFound();
  const loaded = await loadPublished({ slug, config, fetchImpl });
  let storagePath;
  if (field === 'music') {
    const music = loaded.document.legacy && loaded.document.legacy.config && loaded.document.legacy.config.music;
    if (music && music.enabled !== false && typeof music.url === 'string' && MUSIC.test(music.url)
        && music.url.startsWith(`${loaded.project.id}/`)) storagePath = music.url;
  } else {
    storagePath = loaded.candidate.privateImages.find((image) => image.field === field)?.storagePath;
  }
  if (!storagePath) throw notFound();
  const extension = storagePath.split('.').pop().toLowerCase();
  const maxBytes = field === 'music' ? 3_300_000 : 10 * 1024 * 1024;
  const bucket = field === 'music' ? 'invitation-music' : 'invitation-assets';
  const response = await fetchImpl(`${loaded.base}/storage/v1/object/authenticated/${bucket}/${storagePath}`, {
    method: 'GET', redirect: 'error', headers: { apikey: config.secretKey },
  });
  if (!response.ok || Number(response.headers?.get('content-length')) > maxBytes || !response.body?.getReader) throw notFound();
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!(value instanceof Uint8Array) || (total += value.byteLength) > maxBytes) {
      await reader.cancel();
      throw notFound();
    }
    chunks.push(value);
  }
  await loaded.assertCurrent();
  return { bytes: Buffer.concat(chunks, total), mimeType: MIME[extension] };
}

module.exports = { PublicReviewError, readPublicReview, readPublicReviewMedia, publicPresentation };
