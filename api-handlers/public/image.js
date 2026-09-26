import readService from '../../lib/published-image-read.cjs';
import handler from '../../lib/published-image-handler.cjs';

export default handler.createPublishedImageHandler({ readImage: readService.readPublishedImage });
