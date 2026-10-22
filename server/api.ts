// The image proxy's two endpoints (DESIGN.md §7), written once and used by
// the Cloudflare Pages Functions (functions/api/) and by the Vite dev server
// (server/devApi.ts):
//
//   GET /api/fetch-image?url=…  → the image bytes, checked to really be an image
//   GET /api/page-images?url=…  → JSON (PageImagesResult): the images on a page,
//                                  a Pinterest pin's image, or "this is an image"
//
// Nothing is stored or logged.

import type { ApiErrorBody, ApiErrorCode, PageImagesResult } from './apiTypes.ts';
import { extractImages } from './extractImages.ts';
import { pinterestImages, pinterestKind } from './pinterest.ts';
import { RateLimiter } from './rateLimit.ts';
import { readCapped, safeFetch, SafeFetchError, validateUrl, type SafeFetchOptions } from './safeFetch.ts';
import { isHtmlType, sniffImageMime } from './sniff.ts';

export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
export const MAX_HTML_BYTES = 3 * 1024 * 1024;

const IMAGE_ACCEPT = 'image/avif,image/webp,image/png,image/jpeg,image/gif,image/*;q=0.8,*/*;q=0.1';
const PAGE_ACCEPT = 'text/html,application/xhtml+xml,image/*;q=0.9,*/*;q=0.5';

export interface ApiDeps {
  fetchImpl?: typeof fetch;
  checkHost?: SafeFetchOptions['checkHost'];
  timeoutMs?: number;
  limits?: { image: RateLimiter; page: RateLimiter };
}

/** Per-copy limiters: about one page lookup every 3 s and a few images a second, per visitor. */
export const defaultLimits = { image: new RateLimiter(90), page: new RateLimiter(20) };

/** Headers on every answer: never cached by shared caches, never run as a page. */
const BASE_HEADERS = {
  'Cache-Control': 'private, no-store',
  'X-Content-Type-Options': 'nosniff',
  'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
  'Referrer-Policy': 'no-referrer',
};

export function errorResponse(status: number, code: ApiErrorCode, message: string, retryAfter?: number): Response {
  const body: ApiErrorBody = { error: { code, message, ...(retryAfter ? { retryAfter } : {}) } };
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...BASE_HEADERS,
      'Content-Type': 'application/json; charset=utf-8',
      ...(retryAfter ? { 'Retry-After': String(retryAfter) } : {}),
    },
  });
}

/** Turns a fetch failure into a friendly answer. */
function failure(err: unknown): Response {
  if (!(err instanceof SafeFetchError)) return errorResponse(502, 'network', "The site couldn't be reached.");
  switch (err.reason) {
    case 'bad_url':
      return errorResponse(400, 'bad_url', err.message);
    case 'blocked':
      return errorResponse(400, 'blocked', err.message);
    case 'too_large':
      return errorResponse(413, 'too_large', err.message);
    case 'timeout':
      return errorResponse(504, 'timeout', err.message);
    case 'too_many_redirects':
      return errorResponse(502, 'too_many_redirects', err.message);
    case 'http_status': {
      const s = err.status ?? 0;
      if (s === 404 || s === 410) return errorResponse(502, 'not_found', 'The site says that page or image no longer exists.');
      if (s === 401 || s === 403 || s === 429 || s === 451) return errorResponse(502, 'site_refused', 'The site refused to share it.');
      return errorResponse(502, 'site_error', `The site answered with an error (${s}).`);
    }
    default:
      return errorResponse(502, 'network', "The site couldn't be reached.");
  }
}

/** Shared checks: our own pages only, rate limit, and a `url` parameter. */
function precheck(request: Request, limiter: RateLimiter): { url: string } | Response {
  // Browsers say where a request came from; refuse other websites using us as a proxy.
  if (request.headers.get('sec-fetch-site') === 'cross-site') {
    return errorResponse(403, 'forbidden', 'This service only works from the Token Maker site.');
  }
  const ip = request.headers.get('cf-connecting-ip') ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
  const wait = limiter.take(ip);
  if (wait) return errorResponse(429, 'rate_limited', `Too many requests. Try again in ${wait} seconds.`, wait);
  const url = new URL(request.url).searchParams.get('url')?.trim();
  if (!url) return errorResponse(400, 'bad_url', 'Add ?url= with the web address.');
  if (url.length > 4096) return errorResponse(400, 'bad_url', 'That web address is too long.');
  return { url };
}

export async function handleFetchImage(request: Request, deps: ApiDeps = {}): Promise<Response> {
  const pre = precheck(request, (deps.limits ?? defaultLimits).image);
  if (pre instanceof Response) return pre;
  try {
    const { response } = await safeFetch(pre.url, { accept: IMAGE_ACCEPT, ...fetchOptions(deps) });
    const type = response.headers.get('content-type');
    if (isHtmlType(type)) {
      await response.body?.cancel();
      return errorResponse(415, 'not_image', 'That address is a web page, not an image.');
    }
    const body = await readCapped(response, MAX_IMAGE_BYTES);
    const mime = sniffImageMime(body);
    if (!mime) return errorResponse(415, 'not_image', "That address doesn't lead to an image we can open.");
    return new Response(body, {
      status: 200,
      headers: { ...BASE_HEADERS, 'Content-Type': mime, 'Content-Length': String(body.byteLength), 'Content-Disposition': 'inline' },
    });
  } catch (err) {
    return failure(err);
  }
}

export async function handlePageImages(request: Request, deps: ApiDeps = {}): Promise<Response> {
  const pre = precheck(request, (deps.limits ?? defaultLimits).page);
  if (pre instanceof Response) return pre;
  try {
    const start = validateUrl(pre.url);
    if (pinterestKind(start) === 'other') {
      return errorResponse(400, 'pinterest_board', 'Open a single pin on Pinterest and copy its link. Boards and searches can’t be read.');
    }
    const { url, response } = await safeFetch(pre.url, { accept: PAGE_ACCEPT, ...fetchOptions(deps) });
    const type = response.headers.get('content-type');
    if (/^\s*image\//i.test(type ?? '')) {
      await response.body?.cancel();
      return json({ kind: 'image', url: url.toString() });
    }
    const body = await readCapped(response, isHtmlType(type) ? MAX_HTML_BYTES : MAX_IMAGE_BYTES);
    if (!isHtmlType(type)) {
      // Some servers label images wrongly (or not at all): trust the bytes.
      if (sniffImageMime(body)) return json({ kind: 'image', url: url.toString() });
      if (type) return errorResponse(415, 'not_page', "That address isn't a web page or an image.");
    }
    const html = new TextDecoder().decode(body);
    if (pinterestKind(url) === 'pin') {
      const pin = pinterestImages(html, url);
      if (!pin.images.length) return errorResponse(422, 'no_images', "We couldn't find the picture on that pin.");
      return json({ kind: 'pinterest', url: url.toString(), ...pin });
    }
    const page = extractImages(html, url);
    if (!page.images.length) return errorResponse(422, 'no_images', 'No images were found on that page.');
    return json({ kind: 'page', url: url.toString(), ...page });
  } catch (err) {
    return failure(err);
  }
}

function fetchOptions(deps: ApiDeps) {
  return { fetchImpl: deps.fetchImpl, checkHost: deps.checkHost, timeoutMs: deps.timeoutMs };
}

function json(result: PageImagesResult): Response {
  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { ...BASE_HEADERS, 'Content-Type': 'application/json; charset=utf-8' },
  });
}
