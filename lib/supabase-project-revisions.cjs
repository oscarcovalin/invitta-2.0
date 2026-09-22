'use strict';

const { validateInvitationDocument } = require('./invitation-document.cjs');

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RETURN_COLUMNS = 'id,project_id,revision,schema_version,created_by,created_at';

class ProjectRevisionError extends Error {
  constructor(code, message, status) {
    super(message);
    this.name = 'ProjectRevisionError';
    this.code = code;
    this.status = status;
  }
}

function assertRequest({ accessToken, userId, config }) {
  if (!accessToken) throw new ProjectRevisionError('UNAUTHENTICATED', 'Sesión no válida.', 401);
  if (!UUID_PATTERN.test(userId || '')) throw new ProjectRevisionError('UNAUTHENTICATED', 'Sesión no válida.', 401);
  if (!config || !config.url || !config.publishableKey) {
    throw new ProjectRevisionError('PROJECT_STORE_NOT_CONFIGURED', 'El almacenamiento no está configurado.', 503);
  }
}

async function safeJson(response) {
  try { return await response.json(); } catch (_) { return null; }
}

async function saveRevisionWithUserToken({ accessToken, userId, document, config, fetchImpl = fetch }) {
  assertRequest({ accessToken, userId, config });
  const validation = validateInvitationDocument(document);
  if (!validation.valid) {
    throw new ProjectRevisionError('INVALID_DOCUMENT', 'El documento de invitación no es válido.', 422);
  }

  const baseUrl = String(config.url).replace(/\/$/, '');
  const response = await fetchImpl(
    `${baseUrl}/rest/v1/invitation_documents?select=${encodeURIComponent(RETURN_COLUMNS)}`,
    {
      method: 'POST',
      headers: {
        apikey: config.publishableKey,
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        project_id: document.projectId,
        revision: document.revision,
        schema_version: document.schemaVersion,
        document,
        created_by: userId,
      }),
    }
  );
  const payload = await safeJson(response);

  if (!response.ok) {
    if (response.status === 401) throw new ProjectRevisionError('UNAUTHENTICATED', 'Sesión no válida.', 401);
    if (response.status === 403 || (payload && payload.code === '42501')) {
      throw new ProjectRevisionError('PROJECT_ACCESS_DENIED', 'No tienes permiso para editar este proyecto.', 403);
    }
    if (response.status === 409 || (payload && payload.code === '23505')) {
      throw new ProjectRevisionError('REVISION_CONFLICT', 'La revisión ya existe.', 409);
    }
    throw new ProjectRevisionError('REVISION_SAVE_FAILED', 'No fue posible guardar la revisión.', 502);
  }
  if (!Array.isArray(payload) || payload.length !== 1) {
    throw new ProjectRevisionError('REVISION_SAVE_FAILED', 'No fue posible confirmar la revisión.', 502);
  }
  return payload[0];
}

async function publishRevisionWithUserToken({ accessToken, projectId, documentId, config, fetchImpl = fetch }) {
  if (!accessToken) throw new ProjectRevisionError('UNAUTHENTICATED', 'Sesión no válida.', 401);
  if (!config || !config.url || !config.publishableKey) {
    throw new ProjectRevisionError('PROJECT_STORE_NOT_CONFIGURED', 'El almacenamiento no está configurado.', 503);
  }
  if (!UUID_PATTERN.test(projectId || '') || !UUID_PATTERN.test(documentId || '')) {
    throw new ProjectRevisionError('INVALID_PUBLICATION', 'El proyecto o la revisión no son válidos.', 422);
  }

  const baseUrl = String(config.url).replace(/\/$/, '');
  const columns = 'id,published_document_id,status,updated_at';
  const response = await fetchImpl(
    `${baseUrl}/rest/v1/invitation_projects?id=eq.${projectId}&select=${encodeURIComponent(columns)}`,
    {
      method: 'PATCH',
      headers: {
        apikey: config.publishableKey,
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({ published_document_id: documentId, status: 'published' }),
    }
  );
  const payload = await safeJson(response);
  if (!response.ok) {
    if (response.status === 401) throw new ProjectRevisionError('UNAUTHENTICATED', 'Sesión no válida.', 401);
    if (response.status === 403 || (payload && payload.code === '42501')) {
      throw new ProjectRevisionError('PROJECT_ACCESS_DENIED', 'No tienes permiso para publicar este proyecto.', 403);
    }
    if (response.status === 409 || (payload && payload.code === '23503')) {
      throw new ProjectRevisionError('INVALID_PUBLICATION', 'La revisión no pertenece al proyecto.', 409);
    }
    throw new ProjectRevisionError('REVISION_PUBLISH_FAILED', 'No fue posible publicar la revisión.', 502);
  }
  if (!Array.isArray(payload) || payload.length !== 1) {
    throw new ProjectRevisionError('PROJECT_ACCESS_DENIED', 'No tienes permiso para publicar este proyecto.', 403);
  }
  return payload[0];
}

async function getLatestRevisionWithUserToken({ accessToken, projectId, config, fetchImpl = fetch }) {
  if (!accessToken) throw new ProjectRevisionError('UNAUTHENTICATED', 'Sesión no válida.', 401);
  if (!config || !config.url || !config.publishableKey) {
    throw new ProjectRevisionError('PROJECT_STORE_NOT_CONFIGURED', 'El almacenamiento no está configurado.', 503);
  }
  if (!UUID_PATTERN.test(projectId || '')) {
    throw new ProjectRevisionError('INVALID_PROJECT', 'El proyecto no es válido.', 422);
  }

  const baseUrl = String(config.url).replace(/\/$/, '');
  const response = await fetchImpl(
    `${baseUrl}/rest/v1/invitation_documents?project_id=eq.${projectId}&select=${encodeURIComponent('id,project_id,revision,schema_version,document,created_at')}&order=revision.desc&limit=1`,
    {
      method: 'GET',
      headers: { apikey: config.publishableKey, Authorization: `Bearer ${accessToken}` },
    }
  );
  const payload = await safeJson(response);
  if (!response.ok) {
    if (response.status === 401) throw new ProjectRevisionError('UNAUTHENTICATED', 'Sesión no válida.', 401);
    if (response.status === 403) throw new ProjectRevisionError('PROJECT_ACCESS_DENIED', 'No tienes acceso al proyecto.', 403);
    throw new ProjectRevisionError('REVISION_LOAD_FAILED', 'No fue posible cargar la revisión.', 502);
  }
  if (!Array.isArray(payload) || payload.length === 0) {
    throw new ProjectRevisionError('REVISION_NOT_FOUND', 'No hay una revisión visible para este proyecto.', 404);
  }
  return payload[0];
}

module.exports = { ProjectRevisionError, getLatestRevisionWithUserToken, publishRevisionWithUserToken, saveRevisionWithUserToken };
