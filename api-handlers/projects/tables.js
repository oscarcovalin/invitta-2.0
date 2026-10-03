import authService from '../../lib/supabase-auth-service.cjs';
import handlers from '../../lib/project-operations-handler.cjs';
import store from '../../lib/project-operations-store.cjs';
export default handlers.createProjectOperationsHandler({ authService, operate: store.operate, resource: 'tables' });
