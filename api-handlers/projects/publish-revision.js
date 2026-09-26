import authService from '../../lib/supabase-auth-service.cjs';
import publishHandler from '../../lib/publish-revision-handler.cjs';
import revisionService from '../../lib/supabase-project-revisions.cjs';

const { createPublishRevisionHandler } = publishHandler;
const { publishRevisionWithUserToken } = revisionService;

export default createPublishRevisionHandler({
  authService,
  publishRevision: publishRevisionWithUserToken,
});
