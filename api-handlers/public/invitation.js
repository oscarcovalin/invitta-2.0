import readService from '../../lib/published-invitation-read.cjs';
import handler from '../../lib/published-invitation-handler.cjs';

export default handler.createPublishedInvitationHandler({ readInvitation: readService.readPublishedInvitation });
