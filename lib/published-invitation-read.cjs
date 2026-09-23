'use strict';

const { projectPublicInvitation } = require('./public-invitation-projection.cjs');
const { findSamplePublicationFields } = require('./publication-content-preflight.cjs');

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
  const response = await fetchImpl(url, { method: 'GET', headers: { apikey: key } });
  if (!response.ok) throw new PublishedInvitationError(502, 'No fue posible consultar la invitación.');
  const rows = await response.json();
  if (!Array.isArray(rows)) throw new PublishedInvitationError(502, 'No fue posible consultar la invitación.');
  return rows;
}

async function readPublishedInvitation({ slug, config, fetchImpl = fetch }) {
  if (!config || !/^https:\/\/[^/]+\.supabase\.co\/?$/.test(config.url || '')
      || typeof config.secretKey !== 'string' || !config.secretKey.startsWith('sb_secret_')) {
    throw new PublishedInvitationError(503, 'La vista previa no está configurada.');
  }
  if (typeof slug !== 'string' || slug.length > 128 || !SLUG.test(slug)) throw notFound();

  const base = config.url.replace(/\/$/, '');
  const projectUrl = `${base}/rest/v1/invitation_projects?slug=eq.${slug}&select=id%2Cstatus%2Cpublished_document_id&limit=1`;
  const project = (await readRows(projectUrl, config.secretKey, fetchImpl))[0];
  if (!project || project.status !== 'published' || !UUID.test(project.id || '')
      || !UUID.test(project.published_document_id || '')) throw notFound();

  const documentUrl = `${base}/rest/v1/invitation_documents?id=eq.${project.published_document_id}&project_id=eq.${project.id}&select=document&limit=1`;
  const document = (await readRows(documentUrl, config.secretKey, fetchImpl))[0]?.document;
  if (!document || document.schemaVersion !== 1 || document.projectId !== project.id) throw notFound();
  let publicDocument;
  try { publicDocument = projectPublicInvitation(document); }
  catch (_) { throw notFound(); }
  if (!publicDocument.sections.some((section) => section.enabled === true)) throw notFound();
  if (findSamplePublicationFields(publicDocument).length > 0) throw notFound();

  const latest = (await readRows(projectUrl, config.secretKey, fetchImpl))[0];
  if (!latest || latest.status !== 'published' || latest.id !== project.id
      || latest.published_document_id !== project.published_document_id) throw notFound();
  return publicDocument;
}

module.exports = { PublishedInvitationError, readPublishedInvitation };
