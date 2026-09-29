'use strict';

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
const PATH = new RegExp(`^${UUID}/(?:hero|ceremony|reception|gallery|section-background|shared-album|logo)/${UUID}\\.(jpg|png|webp|gif|mp4)$|^${UUID}/music/${UUID}\\.mp3$`, 'i');
const MIME_TYPES = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', mp4: 'video/mp4', mp3: 'audio/mpeg' };
const MAX_BYTES = 10 * 1024 * 1024;

class ProjectAssetReadError extends Error {
  constructor(code, message, status) {
    super(message);
    this.name = 'ProjectAssetReadError';
    this.code = code;
    this.status = status;
  }
}

async function readProjectAsset({ path, accessToken, config, fetchImpl = fetch }) {
  if (!accessToken) throw new ProjectAssetReadError('UNAUTHENTICATED', 'Sesión no válida.', 401);
  if (!config || !config.url || !config.publishableKey) {
    throw new ProjectAssetReadError('STORAGE_NOT_CONFIGURED', 'Storage no está configurado.', 503);
  }
  const match = typeof path === 'string' && PATH.exec(path);
  if (!match) throw new ProjectAssetReadError('INVALID_ASSET_PATH', 'La ruta de imagen no es válida.', 422);
  const response = await fetchImpl(
    `${String(config.url).replace(/\/$/, '')}/storage/v1/object/authenticated/${path.toLowerCase().includes('/music/') ? 'invitation-music' : 'invitation-assets'}/${path}`,
    { method: 'GET', headers: { apikey: config.publishableKey, Authorization: `Bearer ${accessToken}` } }
  );
  if (!response.ok) {
    if (response.status === 401) throw new ProjectAssetReadError('UNAUTHENTICATED', 'Sesión no válida.', 401);
    if (response.status === 403) throw new ProjectAssetReadError('PROJECT_ACCESS_DENIED', 'No tienes permiso para ver este archivo.', 403);
    if (response.status === 404) throw new ProjectAssetReadError('ASSET_NOT_FOUND', 'El archivo no existe.', 404);
    throw new ProjectAssetReadError('ASSET_READ_FAILED', 'No fue posible cargar el archivo.', 502);
  }
  const declaredSize = Number(response.headers && response.headers.get('content-length'));
  if (declaredSize > MAX_BYTES) throw new ProjectAssetReadError('ASSET_TOO_LARGE', 'La imagen excede el límite.', 413);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > MAX_BYTES) throw new ProjectAssetReadError('ASSET_TOO_LARGE', 'La imagen excede el límite.', 413);
  const extension = match[1] || 'mp3';
  return { bytes, mimeType: MIME_TYPES[extension.toLowerCase()] };
}

module.exports = { ProjectAssetReadError, readProjectAsset };
