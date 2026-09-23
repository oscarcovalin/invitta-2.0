'use strict';

const { buildPublicationCandidate } = require('./publication-candidate.cjs');
const { publicationSupabaseOrigin } = require('./publication-supabase-origin.cjs');

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

class PublishedInvitationError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const notFound = () => new PublishedInvitationError(404, 'La invitación no está disponible.');

async function readRows(url, key, fetchImpl) {
  const response = await fetchImpl(url, { method: 'GET', redirect: 'error', headers: { apikey: key } });
  if (!response.ok) throw new PublishedInvitationError(502, 'No fue posible consultar la invitación.');
  const rows = await response.json();
  if (!Array.isArray(rows)) throw new PublishedInvitationError(502, 'No fue posible consultar la invitación.');
  return rows;
}

async function readPublishedInvitation({ slug, config, fetchImpl = fetch }) {
  const base = publicationSupabaseOrigin(config);
  if (!base) {
    throw new PublishedInvitationError(503, 'La vista previa no está configurada.');
  }
  if (typeof slug !== 'string' || slug.length > 128 || !SLUG.test(slug)) throw notFound();

  const projectUrl = `${base}/rest/v1/invitation_projects?slug=eq.${slug}&select=id%2Cstatus%2Cpublished_document_id&limit=1`;
  const project = (await readRows(projectUrl, config.secretKey, fetchImpl))[0];
  if (!project || project.status !== 'published' || !UUID.test(project.id || '')
      || !UUID.test(project.published_document_id || '')) throw notFound();

  const documentUrl = `${base}/rest/v1/invitation_documents?id=eq.${project.published_document_id}&project_id=eq.${project.id}&select=revision%2Cdocument&limit=1`;
  const saved = (await readRows(documentUrl, config.secretKey, fetchImpl))[0];
  if (!saved || !saved.document || saved.revision !== saved.document.revision || saved.document.projectId !== project.id) throw notFound();
  let candidate;
  try { candidate = buildPublicationCandidate({ documentId: project.published_document_id, document: saved.document }); }
  catch (_) { throw notFound(); }

  const latest = (await readRows(projectUrl, config.secretKey, fetchImpl))[0];
  if (!latest || latest.status !== 'published' || latest.id !== project.id
      || latest.published_document_id !== project.published_document_id) throw notFound();
  return candidate.publicArtifact.content;
}

module.exports = { PublishedInvitationError, readPublishedInvitation };
