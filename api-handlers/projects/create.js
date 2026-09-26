import { randomUUID } from 'node:crypto';
import authService from '../../lib/supabase-auth-service.cjs';
import projectHandler from '../../lib/create-project-handler.cjs';
import projectService from '../../lib/supabase-projects.cjs';

export default projectHandler.createProjectHandler({
  authService,
  createProject: projectService.createProjectWithUserToken,
  randomUUID,
});
