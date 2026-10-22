// GET /api/page-images?url=… — lists the images on a web page, or a Pinterest
// pin's image (DESIGN.md §7). The work happens in server/api.ts.
import { handlePageImages } from '../../server/api.ts';

export const onRequestGet: PagesFunction = ({ request }) => handlePageImages(request);
