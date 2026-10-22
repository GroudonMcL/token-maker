// GET /api/fetch-image?url=… — returns an image from the web (DESIGN.md §7).
// The work happens in server/api.ts, shared with the local dev server.
import { handleFetchImage } from '../../server/api.ts';

export const onRequestGet: PagesFunction = ({ request }) => handleFetchImage(request);
