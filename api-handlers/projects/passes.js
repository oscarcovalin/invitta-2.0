import authService from '../../lib/supabase-auth-service.cjs';
import handlers from '../../lib/project-door-handler.cjs';
import store from '../../lib/project-door-store.cjs';
export default handlers.createDoorHandler({authService,operate:store.operatePass});
