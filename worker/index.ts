// The same site as a Cloudflare Worker with static assets, for when it is
// deployed from the Workers screen instead of Pages (Cloudflare now shows
// Workers first). The built site in dist/ is served as it is; /api/* runs the
// same image proxy as the Pages Functions (functions/api/). Without this, a
// Workers deploy answers /api/* with the editor's own page and web imports fail.
// Settings: wrangler.jsonc. Pages ignores both files.

import { handleFetchImage, handlePageImages } from '../server/api.ts';

interface Env {
  ASSETS: Fetcher;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname.startsWith('/api/')) {
      if (request.method === 'GET' && pathname === '/api/fetch-image') return handleFetchImage(request);
      if (request.method === 'GET' && pathname === '/api/page-images') return handlePageImages(request);
      if (pathname === '/api/health') return Response.json({ ok: true });
      return Response.json({ error: { code: 'not_found', message: 'There is nothing at that address.' } }, { status: 404 });
    }
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
