import service from '../../lib/public-review.cjs';
import handlers from '../../lib/public-review-handler.cjs';

export default handlers.createPublicReviewHandler({ readReview: service.readPublicReview });
