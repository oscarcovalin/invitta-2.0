'use strict';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EVENT_TYPES = new Set(['wedding', 'quinceanera', 'other']);
const COLUMNS = 'id,name,event_type,status,created_at,updated_at';

class ProjectStoreError extends Error {
  constructor(code, message, status) {
    super(message);
    this.name = 'ProjectStoreError';
    this.code = code;
    this.status = status;
  }
}

async function createProjectWithUserToken({ accessToken, userId, projectId, name, eventType, config, fetchImpl = fetch }) {
  if (!accessToken || !UUID_PATTERN.test(userId || '')) {
    throw new ProjectStoreError('UNAUTHENTICATED', 'Sesión no válida.', 401);
  }
  if (!config || !config.url || !config.publishableKey) {
    throw new ProjectStoreError('PROJECT_STORE_NOT_CONFIGURED', 'El almacenamiento no está configurado.', 503);
  }
  const cleanName = typeof name === 'string' ? name.trim() : '';
  if (!UUID_PATTERN.test(projectId || '') || !cleanName || cleanName.length > 160 || !EVENT_TYPES.has(eventType)) {
    throw new ProjectStoreError('INVALID_PROJECT', 'El nombre o tipo de evento no es válido.', 422);
  }
  const response = await fetchImpl(
    `${String(config.url).replace(/\/$/, '')}/rest/v1/invitation_projects?select=${encodeURIComponent(COLUMNS)}`,
    {
      method: 'POST',
      headers: {
        apikey: config.publishableKey,
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        id: projectId,
        owner_user_id: userId,
        slug: `p-${projectId.toLowerCase()}`,
        name: cleanName,
        event_type: eventType,
      }),
    }
  );
  let payload;
  try { payload = await response.json(); } catch (_) { payload = null; }
  if (!response.ok) {
    if (response.status === 401) throw new ProjectStoreError('UNAUTHENTICATED', 'Sesión no válida.', 401);
    if (response.status === 403 || (payload && payload.code === '42501')) {
      throw new ProjectStoreError('PROJECT_ACCESS_DENIED', 'No tienes permiso para crear proyectos.', 403);
    }
    if (response.status === 409 || (payload && payload.code === '23505')) {
      throw new ProjectStoreError('PROJECT_CONFLICT', 'El proyecto ya existe.', 409);
    }
    throw new ProjectStoreError('PROJECT_CREATE_FAILED', 'No fue posible crear el proyecto.', 502);
  }
  if (!Array.isArray(payload) || payload.length !== 1 || payload[0].id !== projectId) {
    throw new ProjectStoreError('PROJECT_CREATE_FAILED', 'No fue posible confirmar el proyecto.', 502);
  }
  return payload[0];
}

async function getProjectWithUserToken({ accessToken, projectId, config, fetchImpl = fetch }) {
  if (!accessToken) throw new ProjectStoreError('UNAUTHENTICATED', 'Sesión no válida.', 401);
  if (!config || !config.url || !config.publishableKey) {
    throw new ProjectStoreError('PROJECT_STORE_NOT_CONFIGURED', 'El almacenamiento no está configurado.', 503);
  }
  if (!UUID_PATTERN.test(projectId || '')) {
    throw new ProjectStoreError('INVALID_PROJECT', 'El proyecto no es válido.', 422);
  }
  const response = await fetchImpl(
    `${String(config.url).replace(/\/$/, '')}/rest/v1/invitation_projects?id=eq.${projectId}&select=${encodeURIComponent(COLUMNS)}`,
    { method: 'GET', headers: { apikey: config.publishableKey, Authorization: `Bearer ${accessToken}` } }
  );
  let payload;
  try { payload = await response.json(); } catch (_) { payload = null; }
  if (!response.ok) {
    if (response.status === 401) throw new ProjectStoreError('UNAUTHENTICATED', 'Sesión no válida.', 401);
    if (response.status === 403) throw new ProjectStoreError('PROJECT_ACCESS_DENIED', 'No tienes acceso al proyecto.', 403);
    throw new ProjectStoreError('PROJECT_LOAD_FAILED', 'No fue posible cargar el proyecto.', 502);
  }
  if (!Array.isArray(payload) || payload.length !== 1) {
    throw new ProjectStoreError('PROJECT_NOT_FOUND', 'No hay un proyecto visible con ese ID.', 404);
  }
  return payload[0];
}

async function listProjectsWithUserToken({ accessToken, config, fetchImpl = fetch }) {
  if (!accessToken) throw new ProjectStoreError('UNAUTHENTICATED', 'Sesión no válida.', 401);
  if (!config || !config.url || !config.publishableKey) {
    throw new ProjectStoreError('PROJECT_STORE_NOT_CONFIGURED', 'El almacenamiento no está configurado.', 503);
  }
  const params = new URLSearchParams({
    select: COLUMNS,
    order: 'updated_at.desc',
    limit: '200',
  });
  const response = await fetchImpl(
    `${String(config.url).replace(/\/$/, '')}/rest/v1/invitation_projects?${params}`,
    { method: 'GET', headers: { apikey: config.publishableKey, Authorization: `Bearer ${accessToken}` } }
  );
  let payload;
  try { payload = await response.json(); } catch (_) { payload = null; }
  if (!response.ok) {
    if (response.status === 401) throw new ProjectStoreError('UNAUTHENTICATED', 'Sesión no válida.', 401);
    if (response.status === 403) throw new ProjectStoreError('PROJECT_ACCESS_DENIED', 'No tienes permiso para consultar proyectos.', 403);
    throw new ProjectStoreError('PROJECT_LIST_FAILED', 'No fue posible consultar los proyectos.', 502);
  }
  if (!Array.isArray(payload)) {
    throw new ProjectStoreError('PROJECT_LIST_FAILED', 'No fue posible confirmar los proyectos.', 502);
  }
  return payload;
}

module.exports = { ProjectStoreError, createProjectWithUserToken, getProjectWithUserToken, listProjectsWithUserToken };
