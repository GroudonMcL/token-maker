// Serves /api/* from the Vite dev server (`npm run dev`) and the preview of
// the built site (`npm run preview`) with the same code as
// the Cloudflare Pages Functions, so web imports work locally without
// Wrangler. Unlike Cloudflare, a computer can reach its home network, so here
// every hostname is also looked up in DNS and refused if it points at a
// private address.

import { lookup } from 'node:dns/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import { handleFetchImage, handlePageImages, type ApiDeps } from './api.ts';
import { isBlockedAddress } from './ipRanges.ts';
import { SafeFetchError } from './safeFetch.ts';

async function checkHost(hostname: string): Promise<void> {
  let addresses: { address: string }[];
  try {
    addresses = await lookup(hostname, { all: true });
  } catch {
    throw new SafeFetchError("The site couldn't be reached.", 'network');
  }
  if (!addresses.length || addresses.some((a) => isBlockedAddress(a.address))) {
    throw new SafeFetchError('That address is on a private network.', 'blocked');
  }
}

const ROUTES: Record<string, (request: Request, deps: ApiDeps) => Promise<Response>> = {
  '/api/fetch-image': handleFetchImage,
  '/api/page-images': handlePageImages,
  '/api/health': async () => Response.json({ ok: true }),
};

/** Answers /api/* from Node, like the Pages Functions; anything else goes on to Vite. */
async function apiMiddleware(req: IncomingMessage, res: ServerResponse, next: () => void): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const route = ROUTES[url.pathname];
  if (!route || req.method !== 'GET') return next();
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v);
  const response = await route(new Request(url, { headers }), { checkHost });
  res.statusCode = response.status;
  response.headers.forEach((value, key) => res.setHeader(key, value));
  res.end(Buffer.from(await response.arrayBuffer()));
}

/** The image server for `npm run dev` and `npm run preview` (the built site). */
export function devApi(): Plugin {
  return {
    name: 'token-maker-dev-api',
    configureServer(server) {
      server.middlewares.use(apiMiddleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(apiMiddleware);
    },
  };
}
