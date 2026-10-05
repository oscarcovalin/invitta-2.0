(function (root) {
  'use strict';
  const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  function failure(code, message) { return Object.assign(new Error(message), { code }); }
  function validRecord(row, resource, projectId) {
    return row && uuid(row.id) && row.projectId === projectId && typeof row.name === 'string' && row.name.trim().length > 0 && [...row.name].length <= 160 &&
      Number.isInteger(row.version) && row.version > 0 && Number.isFinite(Date.parse(row.createdAt)) && Number.isFinite(Date.parse(row.updatedAt)) &&
      (resource === 'guests' ? Number.isInteger(row.passes) && row.passes >= 1 && row.passes <= 100 && (row.tableId === null || uuid(row.tableId)) :
        ['circular', 'imperial', 'rectangular'].includes(row.type) && Number.isInteger(row.capacity) && row.capacity >= 1 && row.capacity <= 100);
  }
  class ProjectOrganizerClient {
    constructor(projectId, fetchImpl = root.fetch.bind(root)) {
      if (!uuid(projectId)) throw failure('INVALID_INPUT', 'El proyecto no es válido. Abre el organizador desde el portal.');
      this.projectId = projectId.toLowerCase(); this.fetchImpl = fetchImpl;
      this.guests = []; this.tables = []; this.status = 'initial'; this.generation = 0; this.busy = false; this.pending = null;
    }
    async request(resource, method, data) {
      const url = `/api/projects/${resource}`;
      let response, payload;
      try {
        response = await this.fetchImpl(method === 'GET' ? `${url}?${new URLSearchParams(data)}` : url, {
          method, credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(20000),
          ...(method === 'GET' ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
        });
        payload = await response.json();
      } catch (_) { throw failure(method === 'GET' ? 'UNAVAILABLE' : 'UNKNOWN_RESULT', 'No se pudo confirmar el resultado. Conserva los datos y verifica antes de reintentar.'); }
      if (!response.ok || payload?.success !== true) {
        const unknown = method !== 'GET' && (response.status >= 500 || response.ok);
        throw failure(unknown ? 'UNKNOWN_RESULT' : payload?.code || 'UNAVAILABLE',
          typeof payload?.error === 'string' ? payload.error : 'No se pudo confirmar el resultado.');
      }
      return payload;
    }
    async readAll(resource) {
      const records = []; let cursor;
      for (let page = 0; page < 100; page++) {
        const data = await this.request(resource, 'GET', { projectId: this.projectId, limit: 100, ...(cursor ? { cursor } : {}) });
        if (!Array.isArray(data.records) || data.records.length > 100 || data.records.some(r => !validRecord(r, resource, this.projectId)) ||
          data.records.some((r, i) => (cursor && r.id <= cursor) || (i > 0 && r.id <= data.records[i - 1].id)) ||
          (data.nextCursor !== null && (!uuid(data.nextCursor) || data.nextCursor !== data.records.at(-1)?.id))) throw failure('UNAVAILABLE', 'La respuesta del servidor no es válida.');
        records.push(...data.records);
        if (data.nextCursor === null) return records;
        cursor = data.nextCursor;
      }
      throw failure('UNAVAILABLE', 'La lista excede el límite de esta pantalla; no se mostrará incompleta.');
    }
    async load() {
      if (this.busy || this.pending) throw failure('BUSY', 'Primero verifica la operación pendiente.');
      const generation = ++this.generation; this.status = 'loading';
      try {
        const [tables, guests] = await Promise.all([this.readAll('tables'), this.readAll('guests')]);
        if (generation !== this.generation) return false;
        this.tables = tables; this.guests = guests; this.status = 'ready'; return true;
      } catch (error) { if (generation === this.generation) this.status = 'error'; throw error; }
    }
    confirm(resource, record) {
      this[resource] = [...this[resource].filter(r => r.id !== record.id), record].sort((a, b) => a.id.localeCompare(b.id));
      this.pending = null; this.status = 'ready'; return record;
    }
    async save(resource, input) {
      if (this.busy || this.pending) throw failure('BUSY', 'Primero verifica la operación pendiente.');
      if (!['tables', 'guests'].includes(resource)) throw failure('INVALID_INPUT', 'Recurso inválido.');
      const method = Object.hasOwn(input, 'expectedVersion') ? 'PATCH' : 'POST';
      const data = { ...input, projectId: this.projectId };
      this.busy = true; this.status = 'saving'; ++this.generation;
      try {
        const result = await this.request(resource, method, data);
        if (!validRecord(result.record, resource, this.projectId) || result.record.id !== input.id ||
          (method === 'PATCH' && result.record.version !== input.expectedVersion + 1)) throw failure('UNKNOWN_RESULT', 'Respuesta inesperada. Verifica el estado antes de reintentar.');
        return this.confirm(resource, result.record);
      } catch (error) {
        if (error.code === 'UNKNOWN_RESULT') { this.pending = { resource, method, ...data }; this.status = 'unknown'; }
        else this.status = 'error';
        throw error;
      } finally { this.busy = false; }
    }
    async reconcile() {
      if (!this.pending || this.busy) throw failure('BUSY', 'No hay resultado pendiente para verificar.');
      const pending = this.pending; this.busy = true;
      try {
        const records = await this.readAll(pending.resource);
        const record = records.find(r => r.id === pending.id);
        if (record && (pending.method === 'POST' || record.version === pending.expectedVersion + 1) &&
          Object.entries(pending).every(([key, value]) => ['resource', 'method', 'expectedVersion'].includes(key) || record[key] === value)) return this.confirm(pending.resource, record);
        if (record && (pending.method === 'POST' || record.version !== pending.expectedVersion)) throw failure('CONFLICT', 'La versión actual es distinta. Revisa antes de editar.');
        this.pending = null; this.status = 'ready'; return null;
      } catch (error) { this.status = 'unknown'; throw error; }
      finally { this.busy = false; }
    }
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { ProjectOrganizerClient };
  else root.ProjectOrganizerClient = ProjectOrganizerClient;
})(globalThis);
