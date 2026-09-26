import authService from '../../lib/supabase-auth-service.cjs';
import revisionService from '../../lib/supabase-project-revisions.cjs';
import handler from '../../lib/publication-preview-handler.cjs';

export default handler.createPublicationPreviewHandler({
  authService,
  previewPublication: revisionService.previewPublicationWithUserToken,
});
