const ProjectAssetClient = (() => {
  const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
  const STORAGE_PATH = new RegExp(`^(${UUID})/(hero|ceremony|reception|gallery|section-background|shared-album|logo)/(${UUID})\\.(jpg|png|webp|gif|mp4)$`, 'i');
  const PROXY_PREFIX = '/api/projects/asset?path=';

  function visit(value, convert, keys = []) {
    if (Array.isArray(value)) return value.map((item, index) => visit(item, convert, [...keys, index]));
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, visit(item, convert, [...keys, key])]));
    }
    return typeof value === 'string' ? convert(value, keys) : value;
  }

  function storagePathFromProxy(value, projectId) {
    if (!value.startsWith(PROXY_PREFIX)) return null;
    const path = decodeURIComponent(value.slice(PROXY_PREFIX.length));
    return STORAGE_PATH.test(path) && path.startsWith(`${projectId}/`) ? path : null;
  }

  function toDisplayConfig(config) {
    return visit(config, (value) => STORAGE_PATH.test(value)
      ? `${PROXY_PREFIX}${encodeURIComponent(value)}` : value);
  }

  function slotFor(keys) {
    const path = keys.join('.').toLowerCase();
    if (path.includes('ceremony')) return 'ceremony';
    if (path.includes('reception')) return 'reception';
    if (path.includes('gallery')) return 'gallery';
    if (path.includes('album')) return 'shared-album';
    if (path.includes('logo')) return 'logo';
    if (path.includes('background')) return 'section-background';
    return 'hero';
  }

  async function toStoredConfig(config, { projectId, upload }) {
    const clone = JSON.parse(JSON.stringify(config));
    const pending = [];
    function inspect(value, keys = [], parent, key) {
      if (Array.isArray(value)) return value.forEach((item, index) => inspect(item, [...keys, index], value, index));
      if (value && typeof value === 'object') {
        return Object.entries(value).forEach(([childKey, item]) => inspect(item, [...keys, childKey], value, childKey));
      }
      if (typeof value !== 'string') return;
      const proxyPath = storagePathFromProxy(value, projectId);
      if (proxyPath) { parent[key] = proxyPath; return; }
      if (/^data:/i.test(value)) {
        const match = /^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=]+)$/i.exec(value);
        if (!match) throw new Error(`El archivo incrustado en ${keys.join('.')} no es compatible. Usa JPG, PNG, WebP o GIF.`);
        pending.push({ parent, key, slot: slotFor(keys), mimeType: match[1].toLowerCase(), base64: match[2] });
      } else if (/^https?:\/\//i.test(value) && keys.some((part) => /image|photo|logo|banner|gallery|background|savethedate/i.test(String(part)))) {
        throw new Error(`La imagen externa en ${keys.join('.')} debe subirse como archivo local antes de guardar en nube.`);
      }
    }
    inspect(clone);
    if (pending.length > 30) throw new Error('Hay demasiadas imágenes para un solo guardado.');
    for (const asset of pending) {
      const uploaded = await upload({ projectId, slot: asset.slot, mimeType: asset.mimeType, base64: asset.base64 });
      if (!uploaded || !STORAGE_PATH.test(uploaded.storagePath) || !uploaded.storagePath.startsWith(`${projectId}/`)) {
        throw new Error('Storage devolvió una ruta de imagen no válida.');
      }
      asset.parent[asset.key] = uploaded.storagePath;
    }
    return clone;
  }

  return { toDisplayConfig, toStoredConfig };
})();
if (typeof window !== 'undefined') window.ProjectAssetClient = ProjectAssetClient;
