// Fetching from the web without becoming an open proxy (DESIGN.md §7), ported
// from the extension's server/. Every URL, including each redirect hop, must
// be https, credential-free, on the default port, and not a private IP or a
// local hostname. Bodies are capped while streaming, and the whole request
// (all hops) shares one timeout.
//
// On Cloudflare there is no private network to reach, so checking the URL is
// enough. The Node dev server also passes `checkHost`, which looks the name
// up in DNS and refuses private addresses.

import { ipFamily, isBlockedAddress } from './ipRanges.ts';

export type FetchFailure =
  | 'bad_url'
  | 'blocked'
  | 'too_large'
  | 'http_status'
  | 'network'
  | 'timeout'
  | 'too_many_redirects';

export class SafeFetchError extends Error {
  constructor(
    message: string,
    readonly reason: FetchFailure,
    readonly status?: number,
  ) {
    super(message);
  }
}

export interface SafeFetchOptions {
  /** Default 10 s for the whole request, redirects included. */
  timeoutMs?: number;
  /** Default 5. */
  maxRedirects?: number;
  accept: string;
  /** Extra check run on every hop's hostname (the Node dev server checks DNS here). */
  checkHost?: (hostname: string) => Promise<void>;
  fetchImpl?: typeof fetch;
}

export interface SafeResponse {
  /** The final URL after redirects. */
  url: URL;
  response: Response;
}

/** Names that only mean something on a local network. */
const LOCAL_SUFFIXES = ['.localhost', '.local', '.internal', '.intranet', '.lan', '.home', '.corp', '.home.arpa', '.localdomain'];

export function isLocalHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, '');
  if (host === 'localhost' || !host.includes('.')) return true;
  return LOCAL_SUFFIXES.some((s) => host.endsWith(s));
}

export const USER_AGENT = 'Mozilla/5.0 (compatible; TokenMaker/1.0; +https://token-maker.pages.dev/about)';

/** Checks one URL against the rules; returns it parsed or throws. */
export function validateUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new SafeFetchError("That doesn't look like a web address.", 'bad_url');
  }
  if (url.protocol !== 'https:') throw new SafeFetchError('Only https:// addresses can be fetched.', 'blocked');
  if (url.username || url.password) throw new SafeFetchError('Addresses with a user name or password are not allowed.', 'blocked');
  if (url.port && url.port !== '443') throw new SafeFetchError('Only the normal https port is allowed.', 'blocked');
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  if (ipFamily(hostname) !== 0 ? isBlockedAddress(hostname) : isLocalHostname(hostname)) {
    throw new SafeFetchError('That address is on a private network.', 'blocked');
  }
  return url;
}

/**
 * GETs a URL, following up to `maxRedirects` redirects by hand so every hop
 * is checked. Returns the final OK response with its body unread.
 */
export async function safeFetch(raw: string, options: SafeFetchOptions): Promise<SafeResponse> {
  const fetchImpl = options.fetchImpl ?? ((input, init) => fetch(input, init));
  const maxRedirects = options.maxRedirects ?? 5;
  const signal = AbortSignal.timeout(options.timeoutMs ?? 10_000);
  let url = validateUrl(raw);
  for (let hop = 0; hop <= maxRedirects; hop++) {
    await options.checkHost?.(url.hostname.replace(/^\[|\]$/g, ''));
    let response: Response;
    try {
      response = await fetchImpl(url.toString(), {
        redirect: 'manual',
        signal,
        headers: { Accept: options.accept, 'User-Agent': USER_AGENT, 'Accept-Language': 'en' },
      });
    } catch (err) {
      const name = (err as Error)?.name;
      if (name === 'TimeoutError' || name === 'AbortError') throw new SafeFetchError('The site took too long to answer.', 'timeout');
      throw new SafeFetchError("The site couldn't be reached.", 'network');
    }
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      await response.body?.cancel();
      if (!location) throw new SafeFetchError(`The site answered ${response.status}.`, 'http_status', response.status);
      url = validateUrl(new URL(location, url).toString());
      continue;
    }
    if (!response.ok) {
      await response.body?.cancel();
      throw new SafeFetchError(`The site answered ${response.status}.`, 'http_status', response.status);
    }
    return { url, response };
  }
  throw new SafeFetchError('The address redirected too many times.', 'too_many_redirects');
}

/** Reads a response body, failing as soon as it exceeds `maxBytes`. */
export async function readCapped(response: Response, maxBytes: number): Promise<Uint8Array<ArrayBuffer>> {
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) {
    await response.body?.cancel();
    throw new SafeFetchError('The file is too large.', 'too_large');
  }
  if (!response.body) return new Uint8Array(new ArrayBuffer(0));
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    let chunk: ReadableStreamReadResult<Uint8Array>;
    try {
      chunk = await reader.read();
    } catch (err) {
      const name = (err as Error)?.name;
      if (name === 'TimeoutError' || name === 'AbortError') throw new SafeFetchError('The site took too long to answer.', 'timeout');
      throw new SafeFetchError('The download was cut off.', 'network');
    }
    if (chunk.done) break;
    total += chunk.value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new SafeFetchError('The file is too large.', 'too_large');
    }
    chunks.push(chunk.value);
  }
  const out = new Uint8Array(new ArrayBuffer(total));
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}
