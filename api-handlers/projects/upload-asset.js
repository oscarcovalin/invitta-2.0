import { randomUUID } from 'node:crypto';
import authService from '../../lib/supabase-auth-service.cjs';
import assetHandler from '../../lib/project-asset-upload-handler.cjs';
import assetService from '../../lib/project-asset-upload.cjs';

export default assetHandler.createAssetUploadHandler({
  authService,
  uploadAsset: assetService.uploadProjectAsset,
  randomUUID,
});
