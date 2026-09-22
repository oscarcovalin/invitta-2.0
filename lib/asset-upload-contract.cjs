const MAX_ASSET_BYTES = 10 * 1024 * 1024;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ALLOWED_SLOTS = new Set([
  'hero', 'ceremony', 'reception', 'gallery', 'section-background', 'shared-album', 'logo'
]);

const FILE_TYPES = [
  { mimeType: 'image/jpeg', extension: 'jpg', matches: (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mimeType: 'image/png', extension: 'png', matches: (b) => b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { mimeType: 'image/webp', extension: 'webp', matches: (b) => b.length >= 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP' },
  { mimeType: 'image/gif', extension: 'gif', matches: (b) => b.length >= 6 && ['GIF87a', 'GIF89a'].includes(b.toString('ascii', 0, 6)) },
  { mimeType: 'video/mp4', extension: 'mp4', matches: (b) => b.length >= 12 && b.toString('ascii', 4, 8) === 'ftyp' }
];

class AssetValidationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'AssetValidationError';
    this.code = code;
  }
}

function prepareInvitationAsset({ projectId, assetId, slot, declaredMimeType, bytes }) {
  if (!UUID_PATTERN.test(projectId || '')) {
    throw new AssetValidationError('INVALID_PROJECT_ID', 'A valid project UUID is required.');
  }
  if (!UUID_PATTERN.test(assetId || '')) {
    throw new AssetValidationError('INVALID_ASSET_ID', 'A valid asset UUID is required.');
  }
  if (!ALLOWED_SLOTS.has(slot)) {
    throw new AssetValidationError('INVALID_ASSET_SLOT', 'The asset slot is not allowed.');
  }
  if (!Buffer.isBuffer(bytes) || bytes.length === 0) {
    throw new AssetValidationError('EMPTY_FILE', 'The uploaded file is empty.');
  }
  if (bytes.length > MAX_ASSET_BYTES) {
    throw new AssetValidationError('FILE_TOO_LARGE', 'The uploaded file exceeds 10 MB.');
  }

  const detectedType = FILE_TYPES.find((type) => type.matches(bytes));
  if (!detectedType || detectedType.mimeType !== declaredMimeType) {
    throw new AssetValidationError('FILE_SIGNATURE_MISMATCH', 'The file contents do not match its declared type.');
  }

  return {
    bucket: 'invitation-assets',
    storagePath: `${projectId}/${slot}/${assetId}.${detectedType.extension}`,
    mimeType: detectedType.mimeType,
    size: bytes.length
  };
}

module.exports = { MAX_ASSET_BYTES, AssetValidationError, prepareInvitationAsset };
