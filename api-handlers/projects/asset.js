import authService from '../../lib/supabase-auth-service.cjs';
import readHandler from '../../lib/project-asset-read-handler.cjs';
import readService from '../../lib/project-asset-read.cjs';

export default readHandler.createAssetReadHandler({
  authService,
  readAsset: readService.readProjectAsset,
});
