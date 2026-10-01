import authService from '../lib/supabase-auth-service.cjs';
import requestSession from '../lib/request-auth-session.cjs';

export default requestSession.createSessionHandler({ authService });
