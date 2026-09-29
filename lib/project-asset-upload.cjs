'use strict';

const { prepareInvitationAsset } = require('./asset-upload-contract.cjs');

const MAX_API_BYTES = 3 * 1024 * 1024;
const MAX_AUDIO_API_BYTES = 3_300_000;

class ProjectAssetUploadError extends Error {
  constructor(code, message, status) {
    super(message);
    this.name = 'ProjectAssetUploadError';
    this.code = code;
    this.status = status;
  }
}

async function uploadProjectAsset({
  projectId, assetId, slot, mimeType, base64, accessToken, config, fetchImpl = fetch,
}) {
  if (!accessToken) throw new ProjectAssetUploadError('UNAUTHENTICATED', 'Sesión no válida.', 401);
  if (!config || !config.url || !config.publishableKey) {
    throw new ProjectAssetUploadError('STORAGE_NOT_CONFIGURED', 'Storage no está configurado.', 503);
  }
  const maxApiBytes = slot === 'music' ? MAX_AUDIO_API_BYTES : MAX_API_BYTES;
  const fileLabel = slot === 'music' ? 'La canción' : 'La imagen';
  if (typeof base64 !== 'string' || base64.length > Math.ceil(maxApiBytes * 4 / 3) + 4
      || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(base64)) {
    throw new ProjectAssetUploadError('INVALID_FILE', `${fileLabel} no es válida o excede ${slot === 'music' ? '3.3' : '3'} MB.`, 422);
  }
  const bytes = Buffer.from(base64, 'base64');
  if (bytes.length > maxApiBytes) {
    throw new ProjectAssetUploadError('FILE_TOO_LARGE', `${fileLabel} excede ${slot === 'music' ? '3.3' : '3'} MB.`, 413);
  }
  let asset;
  try {
    asset = prepareInvitationAsset({
      projectId, assetId, slot, declaredMimeType: mimeType, bytes,
    });
  } catch (error) {
    throw new ProjectAssetUploadError(error.code || 'INVALID_FILE', `${fileLabel} no es válida.`, 422);
  }

  const baseUrl = String(config.url).replace(/\/$/, '');
  const response = await fetchImpl(`${baseUrl}/storage/v1/object/${asset.bucket}/${asset.storagePath}`, {
    method: 'POST',
    headers: {
      apikey: config.publishableKey,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': asset.mimeType,
      'x-upsert': 'false',
    },
    body: bytes,
  });
  if (!response.ok) {
    if (response.status === 401) throw new ProjectAssetUploadError('UNAUTHENTICATED', 'Sesión no válida.', 401);
    if (response.status === 403) throw new ProjectAssetUploadError('PROJECT_ACCESS_DENIED', 'No tienes permiso para subir al proyecto.', 403);
    if (response.status === 400 || response.status === 409) {
      throw new ProjectAssetUploadError('ASSET_CONFLICT', 'El archivo ya existe o fue rechazado.', 409);
    }
    throw new ProjectAssetUploadError('UPLOAD_FAILED', 'No fue posible subir la imagen.', 502);
  }
  return asset;
}

module.exports = { MAX_API_BYTES, ProjectAssetUploadError, uploadProjectAsset };
