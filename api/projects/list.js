import authService from '../../lib/supabase-auth-service.cjs';
import projectHandler from '../../lib/list-projects-handler.cjs';
import projectService from '../../lib/supabase-projects.cjs';

export default projectHandler.createListProjectsHandler({
  authService,
  listProjects: projectService.listProjectsWithUserToken,
});
