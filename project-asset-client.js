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

  async function importRemoteImage(value, fetchImpl = fetch) {
    let url;
    try { url = new URL(value); } catch (_) { throw new Error('La URL de imagen no es válida.'); }
    const host = url.hostname.toLowerCase();
    if (url.protocol !== 'https:' || !host || host === 'localhost' || host.endsWith('.local')
        || host.endsWith('.internal') || /^\d+(?:\.\d+){3}$/.test(host) || host.includes(':')) {
      throw new Error('La imagen externa debe usar HTTPS en un dominio público.');
    }
    const response = await fetchImpl(url.href, {
      mode: 'cors', credentials: 'omit', referrerPolicy: 'no-referrer', redirect: 'error',
    });
    if (!response.ok) throw new Error('No se pudo descargar la imagen externa.');
    const mimeType = String(response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(mimeType)) {
      throw new Error('La imagen externa debe ser JPG, PNG, WebP o GIF.');
    }
    const maxBytes = 3 * 1024 * 1024;
    if (Number(response.headers.get('content-length')) > maxBytes) {
      throw new Error('La imagen externa excede 3 MB.');
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (!bytes.length || bytes.length > maxBytes) throw new Error('La imagen externa está vacía o excede 3 MB.');
    let binary = '';
    for (let i = 0; i < bytes.length; i += 8192) {
      binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    }
    return { mimeType, base64: btoa(binary) };
  }

  async function toStoredConfig(config, { projectId, upload, importRemote }) {
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
        if (!importRemote) throw new Error(`La imagen externa en ${keys.join('.')} debe subirse como archivo local antes de guardar en nube.`);
        pending.push({ parent, key, slot: slotFor(keys), remoteUrl: value, field: keys.join('.') });
      }
    }
    inspect(clone);
    if (pending.length > 30) throw new Error('Hay demasiadas imágenes para un solo guardado.');
    for (const asset of pending) {
      if (!asset.remoteUrl) continue;
      try {
        const imported = await importRemote(asset.remoteUrl);
        asset.mimeType = imported.mimeType;
        asset.base64 = imported.base64;
      } catch (error) {
        const reason = error && error.message ? ` ${error.message}` : '';
        throw new Error(`No se pudo importar ${asset.field}.${reason} Súbela como archivo local antes de guardar en nube.`);
      }
    }
    for (const asset of pending) {
      const uploaded = await upload({ projectId, slot: asset.slot, mimeType: asset.mimeType, base64: asset.base64 });
      if (!uploaded || !STORAGE_PATH.test(uploaded.storagePath) || !uploaded.storagePath.startsWith(`${projectId}/`)) {
        throw new Error('Storage devolvió una ruta de imagen no válida.');
      }
      asset.parent[asset.key] = uploaded.storagePath;
    }
    return clone;
  }

  return { importRemoteImage, toDisplayConfig, toStoredConfig };
})();
if (typeof window !== 'undefined') window.ProjectAssetClient = ProjectAssetClient;
