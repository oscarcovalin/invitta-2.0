'use strict';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TYPES = ['circular', 'imperial', 'rectangular'];
const fields = { guests: ['name', 'passes', 'tableId'], tables: ['name', 'type', 'capacity'] };
class OperationError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}
function invalid() { throw new OperationError(422, 'INVALID_INPUT', 'Revisa los datos del proyecto, registro y sus campos.'); }
function isUuid(value) { return typeof value === 'string' && UUID.test(value); }
function validateInput(resource, method, input) {
  if (!fields[resource] || !['GET', 'POST', 'PATCH'].includes(method)) invalid();
  if (!input || typeof input !== 'object' || Array.isArray(input)) invalid();
  const business = fields[resource];
  const allowed = method === 'GET' ? ['projectId', 'cursor', 'limit'] : ['projectId', 'id', ...business, ...(method === 'PATCH' ? ['expectedVersion'] : [])];
  if (Object.keys(input).some(k => !allowed.includes(k)) || !isUuid(input.projectId)) invalid();
  const out = { projectId: input.projectId.toLowerCase() };
  if (method === 'GET') {
    if (input.cursor !== undefined) { if (!isUuid(input.cursor)) invalid(); out.cursor = input.cursor.toLowerCase(); }
    const limit = input.limit === undefined ? 100 : (typeof input.limit === 'string' && /^\d{1,3}$/.test(input.limit) ? Number(input.limit) : input.limit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) invalid();
    return { ...out, limit };
  }
  if (!isUuid(input.id)) invalid();
  out.id = input.id.toLowerCase();
  if (method === 'PATCH') {
    if (!Number.isInteger(input.expectedVersion) || input.expectedVersion < 1 || input.expectedVersion >= 2147483647) invalid();
    out.expectedVersion = input.expectedVersion;
    if (!business.some(k => Object.hasOwn(input, k))) invalid();
  }
  for (const key of business) {
    if (!Object.hasOwn(input, key)) {
      if (method === 'POST') { if (key === 'tableId') out.tableId = null; else invalid(); }
      continue;
    }
    const value = input[key];
    if (key === 'name') {
      if (typeof value !== 'string' || !value.trim() || [...value.trim()].length > 160) invalid();
      out.name = value.trim();
    } else if (key === 'type') {
      if (!TYPES.includes(value)) invalid(); out.type = value;
    } else if (key === 'tableId') {
      if (value !== null && !isUuid(value)) invalid(); out.tableId = value === null ? null : value.toLowerCase();
    } else {
      if (!Number.isInteger(value) || value < 1 || value > 100) invalid(); out[key] = value;
    }
  }
  return out;
}
function unavailable() { return new OperationError(502, 'STORE_UNAVAILABLE', 'No fue posible confirmar la operación. Conserva tus cambios y verifica el estado antes de reintentar.'); }
async function requestRows({ path, params, method = 'GET', body, config, accessToken, fetchImpl }) {
  let response, payload;
  try {
    response = await fetchImpl(`${config.url}/rest/v1/${path}?${params}`, {
      method, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(15000),
      headers: { apikey: config.publishableKey, Authorization: `Bearer ${accessToken}`,
        ...(body ? { 'Content-Type': 'application/json', Prefer: 'return=representation' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    payload = await response.json();
  } catch (_) { throw unavailable(); }
  if (!response.ok) {
    if (response.status === 401) throw new OperationError(401, 'UNAUTHENTICATED', 'Inicia sesión de nuevo.');
    if (response.status === 403) throw new OperationError(403, 'FORBIDDEN', 'No tienes permiso para operar este proyecto.');
    if (payload?.code === '23505') throw new OperationError(409, 'CONFLICT', 'El registro ya existe. Actualiza y verifica antes de reintentar.');
    if (['23503', '23514', '22P02'].includes(payload?.code)) throw new OperationError(422, 'INVALID_INPUT', 'Revisa los campos y la pertenencia de la mesa al proyecto.');
    throw unavailable();
  }
  if (!Array.isArray(payload)) throw unavailable();
  return payload;
}
async function authorizeProject(args, projectId) {
  const projects = await requestRows({ ...args, path: 'invitation_projects', params: new URLSearchParams({ id: `eq.${projectId}`, select: 'id,owner_user_id', limit: '1' }) });
  if (!projects.length) throw new OperationError(404, 'NOT_FOUND', 'El proyecto no está disponible para esta cuenta.');
  if (projects.length !== 1 || projects[0].id !== projectId || !isUuid(projects[0].owner_user_id)) throw unavailable();
  if (projects[0].owner_user_id === args.userId) return;
  const members = await requestRows({ ...args, path: 'invitation_project_members', params: new URLSearchParams({ project_id: `eq.${projectId}`, user_id: `eq.${args.userId}`, select: 'role', limit: '1' }) });
  if (members.length > 1) throw unavailable();
  if (!members.some(m => ['project_owner', 'planner'].includes(m.role))) throw new OperationError(403, 'FORBIDDEN', 'No tienes permiso para operar este proyecto.');
}
function publicRecord(resource, row, projectId) {
  if (!row || !isUuid(row.id) || row.project_id !== projectId || !Number.isInteger(row.version) || row.version < 1 ||
    typeof row.created_at !== 'string' || typeof row.updated_at !== 'string' ||
    !Number.isFinite(Date.parse(row.created_at)) || !Number.isFinite(Date.parse(row.updated_at))) throw unavailable();
  let business;
  try {
    business = validateInput(resource, 'POST', { projectId, id: row.id, name: row.name,
      ...(resource === 'guests' ? { passes: row.passes, tableId: row.table_id } : { type: row.type, capacity: row.capacity }) });
  } catch (_) { throw unavailable(); }
  return { ...business, version: row.version, createdAt: row.created_at, updatedAt: row.updated_at };
}
async function operate({ resource, method, input, config, accessToken, userId, fetchImpl = fetch }) {
  const data = validateInput(resource, method, input);
  if (!config?.url || !config?.publishableKey) throw new OperationError(503, 'NOT_CONFIGURED', 'El almacenamiento del proyecto no está configurado.');
  if (!accessToken || !isUuid(userId)) throw new OperationError(401, 'UNAUTHENTICATED', 'Inicia sesión de nuevo.');
  const args = { config, accessToken, userId, fetchImpl };
  await authorizeProject(args, data.projectId);
  const columns = resource === 'guests' ? 'passes,table_id' : 'type,capacity';
  const params = new URLSearchParams({ project_id: `eq.${data.projectId}`, select: `id,project_id,name,${columns},version,created_at,updated_at` });
  let body;
  if (method === 'GET') {
    params.set('order', 'id.asc'); params.set('limit', String(data.limit));
    if (data.cursor) params.set('id', `gt.${data.cursor}`);
  } else {
    body = {};
    for (const key of fields[resource]) if (Object.hasOwn(data, key)) body[key === 'tableId' ? 'table_id' : key] = data[key];
    if (method === 'POST') { body.id = data.id; body.project_id = data.projectId; }
    else { params.set('id', `eq.${data.id}`); params.set('version', `eq.${data.expectedVersion}`); }
  }
  const rows = await requestRows({ ...args, path: `invitation_${resource}`, params, method, body });
  if (method !== 'GET' && !rows.length) throw new OperationError(409, 'CONFLICT', 'El registro cambió o ya no está disponible. Consulta la versión actual antes de editar.');
  if (rows.length > (method === 'GET' ? data.limit : 1)) throw unavailable();
  const records = rows.map(r => publicRecord(resource, r, data.projectId));
  if (method !== 'GET') {
    if (records[0].id !== data.id || (method === 'PATCH' && records[0].version !== data.expectedVersion + 1)) throw unavailable();
    return { record: records[0] };
  }
  if (records.some((r, i) => (data.cursor && r.id <= data.cursor) || (i && r.id <= records[i - 1].id))) throw unavailable();
  return { records, nextCursor: records.length === data.limit ? records.at(-1).id : null };
}
module.exports = { validateInput, OperationError, isUuid, operate };
