'use strict';

const { buildPublicationCandidate } = require('./publication-candidate.cjs');
const { publicationSupabaseOrigin } = require('./publication-supabase-origin.cjs');

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MIME = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' };
const MAX_BYTES = 10 * 1024 * 1024;

class PublishedImageError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const notFound = () => new PublishedImageError(404, 'La imagen no está disponible.');

async function readRows(url, key, fetchImpl) {
  const response = await fetchImpl(url, { method: 'GET', redirect: 'error', headers: { apikey: key } });
  if (!response.ok) throw new PublishedImageError(502, 'No fue posible consultar la invitación.');
  const rows = await response.json();
  if (!Array.isArray(rows)) throw new PublishedImageError(502, 'No fue posible consultar la invitación.');
  return rows;
}

async function readPublishedImage({ slug, field, config, fetchImpl = fetch }) {
  const base = publicationSupabaseOrigin(config);
  if (!base) {
    throw new PublishedImageError(503, 'La entrega de imágenes no está configurada.');
  }
  if (typeof slug !== 'string' || slug.length > 128 || !SLUG.test(slug)
      || typeof field !== 'string' || field.length > 128 || !/^[a-zA-Z0-9.]+$/.test(field)) throw notFound();

  const projectUrl = `${base}/rest/v1/invitation_projects?slug=eq.${slug}&select=id%2Cstatus%2Cpublished_document_id&limit=1`;
  const rows = await readRows(projectUrl, config.secretKey, fetchImpl);
  const project = rows[0];
  if (!project || project.status !== 'published' || !UUID.test(project.id || '') || !UUID.test(project.published_document_id || '')) throw notFound();

  const documentUrl = `${base}/rest/v1/invitation_documents?id=eq.${project.published_document_id}&project_id=eq.${project.id}&select=revision%2Cdocument&limit=1`;
  const documents = await readRows(documentUrl, config.secretKey, fetchImpl);
  const saved = documents[0];
  if (!saved || !saved.document || saved.revision !== saved.document.revision || saved.document.projectId !== project.id) throw notFound();
  let entry;
  try {
    const candidate = buildPublicationCandidate({ documentId: project.published_document_id, document: saved.document });
    entry = candidate.privateImages.find((image) => image.field === field);
  }
  catch (_) { throw notFound(); }
  if (!entry || !entry.storagePath) throw notFound();

  const extension = entry.storagePath.split('.').pop().toLowerCase();
  const response = await fetchImpl(`${base}/storage/v1/object/authenticated/invitation-assets/${entry.storagePath}`, {
    method: 'GET', redirect: 'error', headers: { apikey: config.secretKey },
  });
  if (!response.ok) throw notFound();
  const declared = Number(response.headers && response.headers.get('content-length'));
  if (declared > MAX_BYTES) throw notFound();
  if (!response.body || typeof response.body.getReader !== 'function') throw notFound();
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!(value instanceof Uint8Array)) {
      await reader.cancel();
      throw notFound();
    }
    total += value.byteLength;
    if (total > MAX_BYTES) {
      await reader.cancel();
      throw notFound();
    }
    chunks.push(value);
  }
  const bytes = Buffer.concat(chunks, total);

  const latest = await readRows(projectUrl, config.secretKey, fetchImpl);
  if (!latest[0] || latest[0].status !== 'published'
      || latest[0].id !== project.id || latest[0].published_document_id !== project.published_document_id) throw notFound();
  return { bytes, mimeType: MIME[extension] };
}

module.exports = { PublishedImageError, readPublishedImage };
