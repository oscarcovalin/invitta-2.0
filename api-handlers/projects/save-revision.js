import authService from '../../lib/supabase-auth-service.cjs';
import projectHandler from '../../lib/project-revision-handler.cjs';
import revisionService from '../../lib/supabase-project-revisions.cjs';

const { createProjectRevisionHandler } = projectHandler;
const { saveRevisionWithUserToken } = revisionService;

export default createProjectRevisionHandler({
  authService,
  saveRevision: saveRevisionWithUserToken,
});
