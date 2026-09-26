(function attachPortalProjectClient(root) {
  const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const DRAFT_KEY_PREFIX = 'invitta.portal.initial-draft.';

  async function readResult(response, fallback) {
    let result;
    try { result = await response.json(); } catch (_) { result = null; }
    if (!response.ok || !result || result.success !== true) {
      throw new Error(result && result.error || fallback);
    }
    return result;
  }

  async function listProjects(fetchImpl = fetch) {
    const response = await fetchImpl('/api/projects/list', {
      method: 'GET', credentials: 'same-origin', cache: 'no-store',
    });
    const result = await readResult(response, 'No fue posible cargar la bóveda de proyectos.');
    if (!Array.isArray(result.projects)) throw new Error('La respuesta de proyectos no es válida.');
    return result.projects;
  }

  async function createProject(input, { fetchImpl = fetch, storage = sessionStorage } = {}) {
    const name = typeof input.name === 'string' ? input.name.trim() : '';
    const eventType = input.eventType;
    if (!name || name.length > 160 || !['wedding', 'quinceanera', 'other'].includes(eventType)) {
      throw new Error('Revisa el nombre y el tipo de evento.');
    }
    const response = await fetchImpl('/api/projects/create', {
      method: 'POST', credentials: 'same-origin', cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, eventType }),
    });
    const result = await readResult(response, 'No fue posible crear el proyecto.');
    const project = result.project;
    if (!project || !UUID_PATTERN.test(project.id || '')) throw new Error('El servidor no confirmó un proyecto válido.');

    let initialDraftStored = false;
    try {
      storage.setItem(`${DRAFT_KEY_PREFIX}${project.id}`, JSON.stringify({
        projectName: name,
        honoree: String(input.honoree || '').trim(),
        eventType,
        startsAt: String(input.startsAt || '').trim(),
        timeZone: String(input.timeZone || 'America/Mexico_City'),
        venue: String(input.venue || '').trim(),
        packageType: input.packageType === 'host_basic' ? 'host_basic' : 'host_premium',
      }));
      initialDraftStored = true;
    } catch (_) {
      // Creation has already succeeded remotely; return its identity so the caller can continue without retrying.
    }
    return { project, initialDraftStored };
  }

  function takeInitialDraft(projectId, storage = sessionStorage) {
    if (!UUID_PATTERN.test(projectId || '')) return null;
    const key = `${DRAFT_KEY_PREFIX}${projectId}`;
    const raw = storage.getItem(key);
    if (!raw) return null;
    storage.removeItem(key);
    try { return JSON.parse(raw); } catch (_) { return null; }
  }

  function applyInitialDraft(config, projectId, storage = sessionStorage) {
    const draft = takeInitialDraft(projectId, storage);
    if (!draft || !config || typeof config !== 'object') return false;
    config.eventType = draft.eventType === 'quinceanera' ? 'xv'
      : draft.eventType === 'wedding' ? 'boda' : 'social';
    config.name = draft.projectName || config.name;
    config.brideName = draft.honoree || config.brideName;
    if (config.eventType === 'xv') config.groomName = '';
    config.eventDateISO = draft.startsAt || config.eventDateISO;
    if (draft.startsAt) {
      config.eventDateLabel = new Date(draft.startsAt).toLocaleDateString('es-MX', {
        day: 'numeric', month: 'long', year: 'numeric', timeZone: draft.timeZone || 'America/Mexico_City',
      });
      config.eventDateShort = new Intl.DateTimeFormat('es-MX', {
        day: 'numeric', month: 'long', year: 'numeric', timeZone: draft.timeZone || 'America/Mexico_City',
      }).format(new Date(draft.startsAt));
    }
    config.timezoneOffset = draft.startsAt ? draft.startsAt.match(/([+-]\d{2}:\d{2})$/)?.[1] || '-06:00' : config.timezoneOffset;
    if (draft.startsAt) {
      config.reception = { ...(config.reception || {}), time: new Intl.DateTimeFormat('es-MX', {
        hour: '2-digit', minute: '2-digit', hour12: true, timeZone: draft.timeZone || 'America/Mexico_City',
      }).format(new Date(draft.startsAt)) };
    }
    config.packageType = draft.packageType || 'host_premium';
    if (draft.venue) config.reception = { ...(config.reception || {}), venue: draft.venue };
    if (config.typography && /^data:/i.test(config.typography.customNamesFile || '')) {
      config.typography.customNamesFile = '';
      config.typography.customNamesFileName = '';
    }
    return true;
  }

  root.InvittaProjectPortal = { listProjects, createProject, takeInitialDraft, applyInitialDraft };
})(typeof window !== 'undefined' ? window : globalThis);
