import authService from '../../lib/supabase-auth-service.cjs';
import latestHandler from '../../lib/latest-revision-handler.cjs';
import revisionService from '../../lib/supabase-project-revisions.cjs';

const { createLatestRevisionHandler } = latestHandler;
const { getLatestRevisionWithUserToken } = revisionService;

export default createLatestRevisionHandler({
  authService,
  loadRevision: getLatestRevisionWithUserToken,
});
