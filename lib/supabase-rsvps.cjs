'use strict';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PROJECT_COLUMNS = 'id,owner_user_id,name,status';
const RSVP_COLUMNS = 'id,guest_name,email,attendance,passes,dietary_option,created_at';

class RsvpStoreError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function invalidProject() {
  return new RsvpStoreError(404, 'No se encontró un proyecto propio para consultar sus respuestas.');
}

function assertStoreConfig(config) {
  if (!config || !config.url || !config.publishableKey) {
    throw new RsvpStoreError(503, 'El almacenamiento no está configurado.');
  }
}

async function readJson(response) {
  try { return await response.json(); } catch (_) { return null; }
}

function restHeaders(config, accessToken) {
  return { apikey: config.publishableKey, Authorization: `Bearer ${accessToken}` };
}

async function getOwnedProject({ accessToken, userId, projectId, config, fetchImpl }) {
  if (!accessToken || !UUID.test(userId || '')) throw new RsvpStoreError(401, 'Sesión no válida.');
  if (!UUID.test(projectId || '')) throw invalidProject();
  const params = new URLSearchParams({ id: `eq.${projectId}`, select: PROJECT_COLUMNS, limit: '1' });
  const response = await fetchImpl(`${String(config.url).replace(/\/$/, '')}/rest/v1/invitation_projects?${params}`, {
    method: 'GET', redirect: 'error', headers: restHeaders(config, accessToken),
  });
  const rows = await readJson(response);
  if (response.status === 401) throw new RsvpStoreError(401, 'Sesión no válida.');
  if (!response.ok || !Array.isArray(rows)) throw new RsvpStoreError(502, 'No fue posible consultar el proyecto.');
  const project = rows[0];
  if (!project || project.owner_user_id !== userId) throw invalidProject();
  return project;
}

async function listProjectRsvps({ accessToken, userId, projectId, config, fetchImpl = fetch }) {
  assertStoreConfig(config);
  const project = await getOwnedProject({ accessToken, userId, projectId, config, fetchImpl });
  const params = new URLSearchParams({
    project_id: `eq.${project.id}`,
    select: RSVP_COLUMNS,
    order: 'created_at.desc',
    limit: '500',
  });
  const response = await fetchImpl(`${String(config.url).replace(/\/$/, '')}/rest/v1/invitation_rsvps?${params}`, {
    method: 'GET', redirect: 'error', headers: restHeaders(config, accessToken),
  });
  const rows = await readJson(response);
  if (response.status === 401) throw new RsvpStoreError(401, 'Sesión no válida.');
  if (!response.ok || !Array.isArray(rows)) throw new RsvpStoreError(502, 'No fue posible cargar las confirmaciones.');
  return { project: { id: project.id, name: project.name, status: project.status }, responses: rows };
}

async function deleteProjectRsvp({ accessToken, userId, projectId, responseId, config, fetchImpl = fetch }) {
  assertStoreConfig(config);
  const project = await getOwnedProject({ accessToken, userId, projectId, config, fetchImpl });
  if (!UUID.test(responseId || '')) throw new RsvpStoreError(422, 'La respuesta seleccionada no es válida.');
  const params = new URLSearchParams({ id: `eq.${responseId}`, project_id: `eq.${project.id}` });
  const response = await fetchImpl(`${String(config.url).replace(/\/$/, '')}/rest/v1/invitation_rsvps?${params}`, {
    method: 'DELETE', redirect: 'error', headers: { ...restHeaders(config, accessToken), Prefer: 'return=minimal' },
  });
  if (response.status === 401) throw new RsvpStoreError(401, 'Sesión no válida.');
  if (!response.ok) throw new RsvpStoreError(502, 'No fue posible eliminar la respuesta.');
  return { deleted: true };
}

module.exports = { RsvpStoreError, deleteProjectRsvp, listProjectRsvps };
