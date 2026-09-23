import authService from '../../lib/supabase-auth-service.cjs';
import projectHandler from '../../lib/get-project-handler.cjs';
import projectService from '../../lib/supabase-projects.cjs';

export default projectHandler.createGetProjectHandler({
  authService,
  getProject: projectService.getProjectWithUserToken,
});
