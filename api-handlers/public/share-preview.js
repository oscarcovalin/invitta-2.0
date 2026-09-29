import service from '../../lib/public-review.cjs';
import handler from '../../lib/public-share-preview-handler.cjs';

export default handler.createPublicSharePreviewHandler({ readReview: service.readPublicReview });
