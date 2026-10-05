import authService from '../../lib/supabase-auth-service.cjs';
import handler from '../../lib/project-rsvps-handler.cjs';
import rsvpService from '../../lib/supabase-rsvps.cjs';

export default handler.createProjectRsvpsHandler({
  authService,
  listRsvps: rsvpService.listProjectRsvps,
  deleteRsvp: rsvpService.deleteProjectRsvp,
});
